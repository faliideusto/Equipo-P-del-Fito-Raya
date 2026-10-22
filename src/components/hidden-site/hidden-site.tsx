"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowRight, EyeOff, RotateCcw, Save, Swords, Trash2, Undo2, Users } from "lucide-react";
import type { Pair, TeamId } from "@/domain/types";
import { emptyLineup } from "@/domain/rules";
import { TeamLogo } from "@/components/team-logo";
import { formatDate } from "@/lib/format";
import type { RivalFixture } from "@/lib/rival-preparation";
import type { RivalLineup } from "@/lib/rival-lineups";
import { HeadToHead } from "./head-to-head";
import { PairEditor } from "./pair-editor";
import { usePlayerStats } from "./use-player-stats";
import type { LineupPlayer } from "./types";

type Tab = "h2h" | "rival" | "own";
const same = (a: Pair[], b: Pair[]) => JSON.stringify(a) === JSON.stringify(b);
const filled = (pairs: Pair[]) => pairs.some(pair => pair.players.some(Boolean));

export function HiddenSite({ teamId, ownName, preparation, division, ownPlayers, rivalPlayers, initialRival, publishedOwn }: {
  teamId: TeamId; ownName: string; preparation: RivalFixture; division: string;
  ownPlayers: LineupPlayer[]; rivalPlayers: LineupPlayer[]; initialRival: RivalLineup | null; publishedOwn: Pair[] | null;
}) {
  const [tab, setTab] = useState<Tab>(initialRival ? "h2h" : "rival");
  const [saved, setSaved] = useState<RivalLineup | null>(initialRival);
  const [rivalPairs, setRivalPairs] = useState<Pair[]>(() => initialRival?.pairs ?? emptyLineup());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  // Our side starts from the one saved here, else from the lineup published for the fixture.
  const [ownPairs, setOwnPairs] = useState<Pair[]>(() => initialRival?.own_pairs ?? publishedOwn ?? emptyLineup());
  const stats = usePlayerStats([...ownPlayers.filter(p => ownPairs.some(pair => pair.players.includes(p.id))), ...rivalPlayers.filter(p => rivalPairs.some(pair => pair.players.includes(p.id)))]);
  const savedRival = saved && filled(saved.pairs) ? saved.pairs : null;
  const savedOwn = saved?.own_pairs ?? null;
  const rivalDirty = !same(rivalPairs, savedRival ?? emptyLineup());
  const ownDirty = !same(ownPairs, savedOwn ?? emptyLineup());

  async function send(action: "save" | "clear" | "save-own" | "clear-own") {
    if (action.startsWith("clear") && !window.confirm(action === "clear" ? "¿Borrar la alineación guardada del rival?" : "¿Borrar nuestra alineación guardada?")) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/rival-lineups", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, teamId, pairs: rivalPairs, ownPairs }) });
      const value = await response.json().catch(() => ({}));
      if (!response.ok) { setMessage(value.error || "No se pudo guardar la alineación."); return; }
      const lineup: RivalLineup | null = value.lineup;
      setSaved(lineup);
      if (action === "save") setRivalPairs(lineup!.pairs);
      if (action === "clear") setRivalPairs(emptyLineup());
      if (action === "save-own") setOwnPairs(lineup!.own_pairs!);
      if (action === "clear-own") setOwnPairs(publishedOwn ?? emptyLineup());
      setMessage(action.startsWith("save") ? "Guardada. Ya la ven el entrenador y los capitanes." : "Alineación borrada.");
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
        <Link className="hs-rival-name" href={`/competicion/equipos/${preparation.rivalId}?division=${division}`}>{preparation.rivalName} <ArrowRight size={16}/></Link>
        <p className="hs-rival-status">{saved ? `Actualizado el ${savedAt}` : "Aún no hay nada guardado"}</p>
      </div>
      <span className="badge blue">Privado</span>
    </section>

    <nav className="hs-tabs" aria-label="Secciones del sitio oculto">{tabs.map(({ id, label, icon: Icon }) => <button key={id} type="button" className={tab === id ? "active" : ""} aria-pressed={tab === id} onClick={() => setTab(id)}><Icon size={16}/>{label}</button>)}</nav>
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
      <div className="hs-panel-head"><div><h2>Alineación del rival</h2><p>La que esperáis que traiga {preparation.rivalName}. Al guardarla la ven el entrenador y todos los capitanes.</p></div></div>
      <PairEditor side="rival" players={rivalPlayers} pairs={rivalPairs} onChange={pairs => { setRivalPairs(pairs); setMessage(""); }}/>
      <div className="hs-actions">
        <button type="button" className="button" disabled={busy || !rivalDirty || !filled(rivalPairs)} onClick={() => send("save")}><Save size={16}/> {busy ? "Guardando…" : rivalDirty || !savedRival ? "Guardar alineación" : "Guardada"}</button>
        {rivalDirty && savedRival && <button type="button" className="button secondary" disabled={busy} onClick={() => setRivalPairs(savedRival)}><Undo2 size={16}/> Descartar cambios</button>}
        {savedRival && <button type="button" className="button secondary" disabled={busy} onClick={() => send("clear")}><Trash2 size={16}/> Borrar</button>}
      </div>
    </section>}

    {tab === "own" && <section className="hs-panel">
      <div className="hs-panel-head"><div><h2>Nuestra alineación</h2><p>Prueba combinaciones y mira los cruces. Al guardarla la ven el entrenador y los capitanes; no cambia la convocatoria publicada de la jornada.</p></div></div>
      <PairEditor side="own" players={ownPlayers} pairs={ownPairs} onChange={pairs => { setOwnPairs(pairs); setMessage(""); }}/>
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
