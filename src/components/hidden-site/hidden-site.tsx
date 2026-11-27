"use client";
import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, CheckCircle2, CloudDownload, EyeOff, RotateCcw, Save, Swords, Trash2, Undo2, Users } from "lucide-react";
import type { Pair } from "@/domain/types";
import { emptyLineup } from "@/domain/rules";
import { TeamLogo } from "@/components/team-logo";
import { formatDate } from "@/lib/format";
import type { RivalFixture } from "@/lib/rival-preparation";
import type { LineupOwner, RivalLineup } from "@/lib/rival-lineups";
import { changedPairs, type LineupFromPoints } from "@/domain/snp-lineup-points";
import { formatPoints } from "@/lib/format";
import { HeadToHead } from "./head-to-head";
import { PairEditor } from "./pair-editor";
import { usePlayerStats } from "./use-player-stats";
import type { LineupPlayer } from "./types";

type Tab = "h2h" | "rival" | "own";
const same = (a: Pair[], b: Pair[]) => JSON.stringify(a) === JSON.stringify(b);
const clubTeamIds = ["7778", "803902"];
const filled = (pairs: Pair[]) => pairs.some(pair => pair.players.some(Boolean));

// owner "tomas": Tomás's own hidden site for his team, saved through its own route and seen only by him.
// fromSnp: the rival's lineup rebuilt from the points SNP shows in this fixture's acta (null if it could not be read).
export function HiddenSite({ teamId, ownName, preparation, division, ownPlayers, rivalPlayers, initialRival, publishedOwn, fromSnp = null }: {
  teamId: LineupOwner; ownName: string; preparation: Omit<RivalFixture, "teamId">; division: string;
  ownPlayers: LineupPlayer[]; rivalPlayers: LineupPlayer[]; initialRival: RivalLineup | null; publishedOwn: Pair[] | null;
  fromSnp?: LineupFromPoints | null;
}) {
  const guest = teamId === "tomas";
  const audience = guest ? "Solo la ves tú" : "La ven el entrenador y los capitanes";
  const snpPairs = fromSnp?.status === "found" ? fromSnp.pairs : null;
  // The rival changed its lineup in SNP since it was saved here: open straight on it.
  const changedOnOpen = fromSnp && initialRival && filled(initialRival.pairs) ? changedPairs(fromSnp, initialRival.pairs) : [];
  const [tab, setTab] = useState<Tab>(initialRival && !changedOnOpen.length ? "h2h" : "rival");
  const [saved, setSaved] = useState<RivalLineup | null>(initialRival);
  // Nothing saved yet: start from what SNP already shows, ready to review and save.
  const [rivalPairs, setRivalPairs] = useState<Pair[]>(() => initialRival && filled(initialRival.pairs) ? initialRival.pairs : snpPairs ?? emptyLineup());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  // Our side starts from the one saved here, else from the lineup published for the fixture.
  const [ownPairs, setOwnPairs] = useState<Pair[]>(() => initialRival?.own_pairs ?? publishedOwn ?? emptyLineup());
  const stats = usePlayerStats([...ownPlayers.filter(p => ownPairs.some(pair => pair.players.includes(p.id))), ...rivalPlayers.filter(p => rivalPairs.some(pair => pair.players.includes(p.id)))]);
  const savedRival = saved && filled(saved.pairs) ? saved.pairs : null;
  const savedOwn = saved?.own_pairs ?? null;
  const rivalDirty = !same(rivalPairs, savedRival ?? emptyLineup());
  const ownDirty = !same(ownPairs, savedOwn ?? emptyLineup());
  const snpChanges = fromSnp && savedRival ? changedPairs(fromSnp, savedRival) : [];

  async function send(action: "save" | "clear" | "save-own" | "clear-own") {
    if (action.startsWith("clear") && !window.confirm(action === "clear" ? "¿Borrar la alineación guardada del rival?" : "¿Borrar nuestra alineación guardada?")) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch(guest ? "/api/rival-lineups/tomas" : "/api/rival-lineups", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...(guest ? {} : { teamId }), pairs: rivalPairs, ownPairs }) });
      const value = await response.json().catch(() => ({}));
      if (!response.ok) { setMessage(value.error || "No se pudo guardar la alineación."); return; }
      const lineup: RivalLineup | null = value.lineup;
      setSaved(lineup);
      if (action === "save") setRivalPairs(lineup!.pairs);
      if (action === "clear") setRivalPairs(emptyLineup());
      if (action === "save-own") setOwnPairs(lineup!.own_pairs!);
      if (action === "clear-own") setOwnPairs(publishedOwn ?? emptyLineup());
      setMessage(action.startsWith("save") ? `Guardada. ${audience}.` : "Alineación borrada.");
    } catch { setMessage("No se pudo conectar. Inténtalo de nuevo."); }
    finally { setBusy(false); }
  }
  const profile = (player: LineupPlayer, team: string) => player.snpId ? `/competicion/jugadores/${player.snpId}?equipo=${team}&division=${division}` : null;
  const savedAt = saved && new Date(saved.updated_at).toLocaleString("es-ES", { timeZone: "Europe/Madrid", dateStyle: "short", timeStyle: "short" });
  const tabs: { id: Tab; label: string; icon: typeof Swords }[] = [
    { id: "h2h", label: "Cara a cara", icon: Swords },
    { id: "rival", label: "Rival", icon: EyeOff },
    { id: "own", label: "Nosotros", icon: Users },
  ];

  return <div className="hidden-site">
    <section className="hs-rival-card">
      <TeamLogo name={preparation.rivalName}/>
      <div>
        <p className="eyebrow">Jornada {preparation.round}{preparation.date ? ` · ${formatDate(preparation.date)}` : ""}</p>
        {/* Tomás's account can't open the club's own team pages, so his rival link skips them. */}
        {guest && clubTeamIds.includes(preparation.rivalId)
          ? <p className="hs-rival-name">{preparation.rivalName}</p>
          : <Link className="hs-rival-name" href={`/competicion/equipos/${preparation.rivalId}?division=${division}`}>{preparation.rivalName} <ArrowRight size={16}/></Link>}
        <p className="hs-rival-status">{saved ? `Actualizado el ${savedAt}` : "Aún no hay nada guardado"}</p>
        {snpChanges.length > 0 && <p className="hs-rival-alert"><AlertTriangle size={14}/> Ha cambiado su alineación en SNP</p>}
      </div>
      <span className="badge blue">Privado</span>
    </section>

    <nav className="hs-tabs" aria-label="Secciones del sitio oculto">{tabs.map(({ id, label, icon: Icon }) => <button key={id} type="button" className={tab === id ? "active" : ""} aria-pressed={tab === id} onClick={() => setTab(id)}><Icon size={16}/>{label}{id === "rival" && snpChanges.length > 0 && <span className="hs-tab-dot" aria-label="con cambios en SNP"/>}</button>)}</nav>
    {message && <p className="hs-message" role="status">{message}</p>}

    {tab === "h2h" && (filled(rivalPairs) && filled(ownPairs)
      ? <HeadToHead stats={stats}
        own={{ name: ownName, players: ownPlayers, pairs: ownPairs, profile: player => profile(player, player.snpTeam ?? "") }}
        rival={{ name: preparation.rivalName, players: rivalPlayers, pairs: rivalPairs, profile: player => profile(player, preparation.rivalId) }}/>
      : <section className="hs-empty">
        <Swords size={28}/>
        <h2>Monta las dos alineaciones</h2>
        <p>Para ver los cruces hace falta la alineación del rival y la nuestra.</p>
        <div>{!filled(rivalPairs) && <button type="button" className="button small" onClick={() => setTab("rival")}>Alineación del rival</button>}{!filled(ownPairs) && <button type="button" className="button secondary small" onClick={() => setTab("own")}>Nuestra alineación</button>}</div>
      </section>)}

    {tab === "rival" && <section className="hs-panel">
      <div className="hs-panel-head"><div><h2>Alineación del rival</h2><p>La que esperáis que traiga {preparation.rivalName}. {guest ? "Se queda guardada y solo la ves tú." : "Al guardarla la ven el entrenador y todos los capitanes."}</p></div></div>
      <SnpPanel fromSnp={fromSnp} rivalName={preparation.rivalName} players={rivalPlayers} changes={snpChanges} hasSaved={Boolean(savedRival)}
        showUse={Boolean(snpPairs && !same(rivalPairs, snpPairs))} onUse={() => { setRivalPairs(snpPairs!); setMessage("Cargada la alineación de SNP. Revisa los empates y guárdala."); }}/>
      <PairEditor side="rival" players={rivalPlayers} pairs={rivalPairs} profile={player => profile(player, preparation.rivalId)} stats={stats} onChange={pairs => { setRivalPairs(pairs); setMessage(""); }}/>
      <div className="hs-actions">
        <button type="button" className="button" disabled={busy || !rivalDirty || !filled(rivalPairs)} onClick={() => send("save")}><Save size={16}/> {busy ? "Guardando…" : rivalDirty || !savedRival ? "Guardar alineación" : "Guardada"}</button>
        {rivalDirty && savedRival && <button type="button" className="button secondary" disabled={busy} onClick={() => setRivalPairs(savedRival)}><Undo2 size={16}/> Descartar cambios</button>}
        {savedRival && <button type="button" className="button secondary" disabled={busy} onClick={() => send("clear")}><Trash2 size={16}/> Borrar</button>}
      </div>
    </section>}

    {tab === "own" && <section className="hs-panel">
      <div className="hs-panel-head"><div><h2>Nuestra alineación</h2><p>Prueba combinaciones y mira los cruces. {guest ? "Se queda guardada y solo la ves tú." : "Al guardarla la ven el entrenador y los capitanes; no cambia la convocatoria publicada de la jornada."}</p></div></div>
      <PairEditor side="own" players={ownPlayers} pairs={ownPairs} profile={player => profile(player, player.snpTeam ?? "")} stats={stats} onChange={pairs => { setOwnPairs(pairs); setMessage(""); }}/>
      <div className="hs-actions">
        <button type="button" className="button" disabled={busy || !ownDirty || !filled(ownPairs)} onClick={() => send("save-own")}><Save size={16}/> {busy ? "Guardando…" : ownDirty || !savedOwn ? "Guardar alineación" : "Guardada"}</button>
        <button type="button" className="button secondary" onClick={() => setTab("h2h")}><Swords size={16}/> Ver cara a cara</button>
        {publishedOwn && !same(ownPairs, publishedOwn) && <button type="button" className="button secondary" onClick={() => setOwnPairs(publishedOwn)}><Undo2 size={16}/> Usar la publicada</button>}
        {filled(ownPairs) && <button type="button" className="button secondary" onClick={() => setOwnPairs(emptyLineup())}><RotateCcw size={16}/> Vaciar</button>}
        {savedOwn && <button type="button" className="button secondary" disabled={busy} onClick={() => send("clear-own")}><Trash2 size={16}/> Borrar guardada</button>}
      </div>
    </section>}
  </div>;
}

// What SNP's acta says about the rival's lineup: each pair as SNP has it, the tied players to choose
// from, and which pairs changed since the lineup was saved here.
function SnpPanel({ fromSnp, rivalName, players, changes, hasSaved, showUse, onUse }: {
  fromSnp: LineupFromPoints | null; rivalName: string; players: LineupPlayer[]; changes: number[]; hasSaved: boolean; showUse: boolean; onUse: () => void;
}) {
  if (!fromSnp) return null;
  if (fromSnp.status === "none") return <section className="hs-snp is-none">
    <span className="hs-snp-icon"><CloudDownload size={18}/></span>
    <div><strong>{rivalName} aún no ha metido su alineación en SNP</strong><small>Se vuelve a mirar cada vez que entras aquí.</small></div>
  </section>;
  const name = (id: string) => players.find(player => player.id === id)?.name ?? "Jugador";
  const points = (id: string) => players.find(player => player.id === id)?.points ?? 0;
  const state = changes.length ? "is-changed" : hasSaved ? "is-match" : "is-new";
  const pill = changes.length ? "Ha cambiado" : hasSaved ? "Coincide con la guardada" : "Sin guardar";
  const list = (pairs: number[]) => pairs.map(n => `P${n}`).join(pairs.length === 2 ? " y " : ", ").replace(/, (P\d)$/, " y $1");
  return <section className={`hs-snp ${state}`}>
    <header>
      <span className="hs-snp-icon"><CloudDownload size={18}/></span>
      <div><strong>Alineación de {rivalName} en SNP</strong><small>Sacada de los puntos de cada jugador en el acta.</small></div>
      <span className="hs-snp-pill">{changes.length ? <AlertTriangle size={14}/> : hasSaved ? <CheckCircle2 size={14}/> : null}{pill}</span>
    </header>
    {changes.length > 0 && <p className="hs-snp-alert"><AlertTriangle size={16}/><span><b>Han cambiado la alineación.</b> No coincide con la guardada en {changes.length === 1 ? "la" : "las"} {list(changes)}.</span></p>}
    <ol className="hs-snp-pairs">{fromSnp.pairs.map((pair, index) => {
      const n = index + 1;
      return <li key={pair.id} className={changes.includes(n) ? "is-changed" : ""}>
        <span className="hs-pair-number">P{n}</span>
        {pair.players.map((id, slot) => {
          const tie = fromSnp.ties.find(item => item.pair === n && item.slot === slot);
          const miss = fromSnp.missing.find(item => item.pair === n && item.slot === slot);
          if (!id) return <div key={slot} className="hs-snp-player is-empty">
            <span>{miss ? "Jugador sin identificar" : "Sin datos"}</span>
            {miss && <small>{formatPoints(miss.points)} pts · nadie de la plantilla los tiene</small>}
          </div>;
          return <div key={slot} className={`hs-snp-player${tie ? " is-tie" : ""}`}>
            <span>{name(id)}</span>
            <small>{formatPoints(points(id))} pts</small>
            {tie && <small className="hs-snp-tie">Empate: o {tie.candidates.filter(other => other !== id).map(name).join(", ")}</small>}
          </div>;
        })}
      </li>;
    })}</ol>
    {(showUse || fromSnp.ties.length > 0) && <footer>
      {fromSnp.ties.length > 0 && <small>Si hay empate de puntos no se sabe cuál de ellos juega: se pone uno y puedes cambiarlo.</small>}
      {showUse && <button type="button" className="button small" onClick={onUse}><CloudDownload size={16}/> Usar la de SNP</button>}
    </footer>}
  </section>;
}
