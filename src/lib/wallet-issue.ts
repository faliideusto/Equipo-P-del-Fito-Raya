import { randomBytes, randomUUID } from "node:crypto";
import { clubRepository } from "@/data/repository";
import { lastPlayedFixture } from "@/domain/pending-results";
import { buildWalletCard, type TeamCardContext } from "@/domain/wallet-card";
import type { Fixture, Player, TeamId } from "@/domain/types";
import { AccountError, currentAccount } from "./account-auth";
import { playerLink } from "./account-profile";
import { teamResultScore } from "./team-result-service";
import { getSnpMatch } from "./snp-service";
import { appleConfig, googleConfig, publicBaseUrl } from "./wallet-config";
import { signApplePass } from "./wallet-apple";
import { googleObjectId, googleSaveUrl } from "./wallet-google";
import { HERO, renderStrip } from "./wallet-strip";
import type { WalletPass, WalletStore } from "./wallet-store";
type ScoreOf = (teamId: TeamId, fixture: Fixture) => Promise<[number, number] | null>;
type PlaceOf = (fixture: Fixture) => Promise<string | null>;
// Where the match is played, from the "Lugar" of the SNP acta.
const actaPlace: PlaceOf = fixture => getSnpMatch(fixture.id).then(r => r.data.venue ?? null);
// Our side's score for a fixture: app/acta pairs first, then SNP's published score.
const fallbackScore = (fixture: Fixture): [number, number] | null => fixture.score ? (fixture.home ? fixture.score : [fixture.score[1], fixture.score[0]]) : null;
export async function teamContext(teamId: TeamId, players: Player[], fixtures: Fixture[], store: WalletStore, now: number, scoreOf: ScoreOf = teamResultScore, placeOf: PlaceOf = actaPlace): Promise<TeamCardContext> {
  const next = fixtures.find(f => f.status === "pending") ?? null;
  const last = lastPlayedFixture(fixtures, now);
  const [published, score, place] = await Promise.all([next ? store.publishedLineup(teamId, next.id) : null, last ? scoreOf(teamId, last).catch(() => null).then(s => s ?? fallbackScore(last)) : null, next && !next.home ? placeOf(next).catch(() => null) : null]);
  return {
    teamId,
    players: players.filter(p => p.sourceId).map(p => ({ id: p.id, sourceId: p.sourceId!, name: p.name, nickname: p.nickname ?? null, position: p.position, points: p.points })),
    next: next && { id: next.id, round: next.round, opponent: next.opponent, date: next.date, home: next.home, place },
    published: published && { fixtureId: published.fixture_id, pairs: published.pairs },
    last: last && score ? { fixtureId: last.id, round: last.round, opponent: last.opponent, ours: score[0], theirs: score[1] } : null,
  };
}
export async function loadTeamContext(teamId: TeamId, store: WalletStore, now = Date.now()): Promise<TeamCardContext> {
  const [players, fixtures] = await Promise.all([clubRepository.getPlayers(teamId), clubRepository.getFixtures(teamId)]);
  return teamContext(teamId, players, fixtures, store, now);
}
export async function ensurePass(store: WalletStore, playerId: string, teamId: TeamId): Promise<WalletPass> {
  return (await store.passFor(playerId, teamId)) ?? store.createPass({ serial: randomUUID(), player_id: playerId, team_id: teamId, auth_token: randomBytes(32).toString("base64url"), google_object_id: null, updated_at: new Date().toISOString() });
}
export async function walletTeams(playerId: string): Promise<TeamId[]> {
  const teams: TeamId[] = [];
  for (const teamId of ["a", "b"] as const) if ((await clubRepository.getPlayers(teamId)).some(p => p.sourceId === playerId)) teams.push(teamId);
  return teams;
}
export async function requireWalletPlayer(team: string | null): Promise<{ playerId: string; teamId: TeamId }> {
  if (team !== "a" && team !== "b") throw new AccountError("Equipo no válido.");
  const user = await currentAccount(); if (!user) throw new AccountError("Inicia sesión para añadir tu tarjeta.", 401);
  if (user.role !== "player") throw new AccountError("La tarjeta es solo para jugadores.", 403);
  const link = await playerLink(user.id); if (!link) throw new AccountError("Vincula primero tu ficha de jugador.", 403);
  if (!(await walletTeams(link.player_id)).includes(team)) throw new AccountError("No estás en la plantilla de este equipo.", 403);
  return { playerId: link.player_id, teamId: team };
}
export async function applePassBuffer(pass: WalletPass, store: WalletStore): Promise<Buffer | null> {
  const config = appleConfig(); const baseUrl = publicBaseUrl(); if (!config || !baseUrl) return null;
  const card = buildWalletCard(await loadTeamContext(pass.team_id, store), pass.player_id);
  return card ? signApplePass(card, { serial: pass.serial, authToken: pass.auth_token, baseUrl }, config) : null;
}
// The hero image of a Google card, drawn from current data; null if the player left the roster.
export async function googleHeroImage(pass: WalletPass, store: WalletStore): Promise<Buffer | null> {
  const card = buildWalletCard(await loadTeamContext(pass.team_id, store), pass.player_id);
  return card ? renderStrip(card, 3, HERO) : null;
}
export async function googleSaveLink(pass: WalletPass, store: WalletStore): Promise<string | null> {
  const config = googleConfig(); const baseUrl = publicBaseUrl(); if (!config || !baseUrl) return null;
  const card = buildWalletCard(await loadTeamContext(pass.team_id, store), pass.player_id); if (!card) return null;
  if (!pass.google_object_id) await store.setGoogleObject(pass.serial, googleObjectId(config.issuerId, pass.serial));
  return googleSaveUrl(card, { serial: pass.serial, baseUrl }, config);
}
