import { accountBody, accountFailure, accountReply, AccountError, currentAccount, limitAccountAttempts } from "@/lib/account-auth";
import { playerLink } from "@/lib/account-profile";
import { isCoachSession } from "@/lib/coach-session";
import { checkSets } from "@/domain/match-result";
import { coachResults, managedPairs, myFixtureResult, pendingResults, resolvePair } from "@/lib/pending-results-service";
import { shareableTeams } from "@/lib/team-captains";
import { clubRepository } from "@/data/repository";
import { getSnpMatch } from "@/lib/snp-service";
import { deleteResult, DuplicateResultError, listResults, replaceResult, saveAbsence, saveResult } from "@/lib/match-results";
import type { TeamId } from "@/domain/types";
export const runtime = "nodejs";
const isTeam = (value: unknown): value is TeamId => value === "a" || value === "b";
const isFixture = (value: unknown): value is string => typeof value === "string" && /^\d{1,10}$/.test(value);
export async function GET() {
  try {
    if (!await isCoachSession()) throw new AccountError("Inicia sesión como entrenador.", 401);
    return accountReply({ teams: await coachResults() });
  } catch (error) { return accountFailure(error); }
}
export async function POST(request: Request) {
  try {
    const body = await accountBody(request);
    const user = await currentAccount();
    if (!user) throw new AccountError("Inicia sesión para registrar resultados.", 401);
    if (body.action === "edit" && isTeam(body.teamId) && isFixture(body.fixtureId) && (await shareableTeams(user)).includes(body.teamId)) {
      // Coach or captain: enter missing results or correct them, keeping the original author.
      limitAccountAttempts(`result:${user.id}`);
      const pair = resolvePair(null, body.pairIndex);
      if (!pair) throw new AccountError("Elige tu número de pareja (1 a 5).");
      const fixture = (await clubRepository.getFixtures(body.teamId)).find(f => f.id === body.fixtureId);
      if (!fixture) throw new AccountError("No se encontró la jornada.", 404);
      const rows = await listResults([fixture.id]);
      const existing = rows.find(r => r.team_id === body.teamId && r.pair_index === pair);
      const acta = await getSnpMatch(fixture.id).then(r => r.data).catch(() => null);
      if (!managedPairs(fixture, acta).includes(pair)) throw new AccountError("Este resultado ya no se puede modificar: aún no ha pasado una hora desde el inicio o SNP ya lo ha publicado.", 409);
      const check = checkSets(body.sets);
      if (!check.ok) throw new AccountError(check.error);
      if (existing) await replaceResult({ ...existing, sets: check.sets });
      else {
        if (user.role === "coach") throw new AccountError("Para añadir un resultado, inicia sesión con una cuenta de capitán.", 403);
        const link = await playerLink(user.id);
        if (!link) throw new AccountError("Vincula primero tu ficha SNP.");
        try { await saveResult({ fixture_id: fixture.id, team_id: body.teamId, pair_index: pair, sets: check.sets, player_id: link.player_id, submitted_by: user.id, created_at: new Date().toISOString() }); }
        catch (error) {
          if (!(error instanceof DuplicateResultError)) throw error;
          throw new AccountError("Esta pareja acaba de registrar un resultado. Recarga el acta antes de modificarlo.", 409);
        }
      }
      return accountReply({ ok: true });
    }
    if (user.role === "coach" || user.role === "visitor") throw new AccountError("Solo los jugadores registran resultados.", 403);
    limitAccountAttempts(`result:${user.id}`);
    if (!isTeam(body.teamId) || !isFixture(body.fixtureId) || !["result", "absent", "confirm", "edit"].includes(String(body.action))) throw new AccountError("Petición no válida.");
    const link = await playerLink(user.id); if (!link) throw new AccountError("Vincula primero tu ficha SNP.");
    if (body.action === "edit") {
      const mine = await myFixtureResult(user.id, link.player_id, body.teamId, body.fixtureId);
      if (!mine || mine.pairIndex !== body.pairIndex) throw new AccountError("No tienes un resultado de esta pareja para modificar.", 403);
      if (!mine.editable) throw new AccountError("SNP ya ha publicado este partido: el resultado ya no se puede modificar.", 409);
      const check = checkSets(body.sets);
      if (!check.ok) throw new AccountError(check.error);
      await replaceResult({ fixture_id: body.fixtureId, team_id: body.teamId, pair_index: mine.pairIndex, sets: check.sets, player_id: link.player_id, submitted_by: user.id, created_at: new Date().toISOString() });
      return accountReply({ ok: true, result: await myFixtureResult(user.id, link.player_id, body.teamId, body.fixtureId) });
    }
    const pending = (await pendingResults(user.id, link.player_id)).find(p => p.fixtureId === body.fixtureId && p.teamId === body.teamId);
    if (!pending) throw new AccountError("Esta jornada ya no tiene resultado pendiente.", 409);
    const now = new Date().toISOString();
    if (body.action === "absent") await saveAbsence({ user_id: user.id, fixture_id: pending.fixtureId, reason: "absent", pair_index: null, created_at: now });
    else {
      const pair = resolvePair(pending.pairLocked, body.pairIndex);
      if (!pair) throw new AccountError("Elige tu número de pareja (1 a 5).");
      if (body.action === "confirm") {
        if (pending.pairLocked) throw new AccountError("Petición no válida.");
        const existing = (await listResults([pending.fixtureId])).find(r => r.team_id === pending.teamId && r.pair_index === pair);
        if (!existing) throw new AccountError("No hay ningún resultado registrado para esa pareja.");
        await saveAbsence({ user_id: user.id, fixture_id: pending.fixtureId, reason: "already_reported", pair_index: pair, created_at: now });
      } else {
        const check = checkSets(body.sets);
        if (!check.ok) throw new AccountError(check.error);
        try { await saveResult({ fixture_id: pending.fixtureId, team_id: pending.teamId, pair_index: pair, sets: check.sets, player_id: link.player_id, submitted_by: user.id, created_at: now }); }
        catch (error) {
          if (!(error instanceof DuplicateResultError)) throw error;
          const existing = (await listResults([pending.fixtureId])).find(r => r.team_id === pending.teamId && r.pair_index === pair);
          return accountReply({ error: "Esta pareja ya tiene resultado registrado por un compañero.", existing: existing?.sets ?? null, pairIndex: pair }, 409);
        }
      }
    }
    return accountReply({ ok: true, pending: await pendingResults(user.id, link.player_id) });
  } catch (error) { return accountFailure(error); }
}
export async function DELETE(request: Request) {
  try {
    const body = await accountBody(request);
    if (!await isCoachSession()) throw new AccountError("Inicia sesión como entrenador.", 401);
    const pair = resolvePair(null, body.pairIndex);
    if (!isTeam(body.teamId) || !isFixture(body.fixtureId) || !pair) throw new AccountError("Petición no válida.");
    await deleteResult(body.fixtureId, body.teamId, pair);
    return accountReply({ ok: true, teams: await coachResults() });
  } catch (error) { return accountFailure(error); }
}
