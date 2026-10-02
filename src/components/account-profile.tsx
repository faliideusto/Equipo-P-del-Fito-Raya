"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeading } from "./sports";
import { ExplorerPlayer } from "./explorer-player";
import { RosterChoice } from "./roster-choice";
import { PositionOptions } from "./account-access";
import { CoachDashboard } from "./coach-dashboard";
import type { PlayerLink } from "@/lib/account-profile";
type Account = { user: { id: string; email: string; role?: string; position?: string } | null; link: PlayerLink | null };
type TeamStats = { id: string; position: string | null; rank: number; played: number; won: number; lost: number; setsWon: number; setsLost: number; points: number; partial: boolean; stale: boolean; acts: number };
export function AccountProfile() {
  const router = useRouter();
  const [account, setAccount] = useState<Account | null>(null); const [error, setError] = useState(""); const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false); const [position, setPosition] = useState(""); const [teams, setTeams] = useState<TeamStats[] | null>(null); const [statsError, setStatsError] = useState("");
  async function refreshAccount() {
    const response = await fetch("/api/account", { cache: "no-store" }); const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    setAccount(data); setPosition(data.link?.position ?? data.user?.position ?? "");
  }
  useEffect(() => { void refreshAccount().catch(e => setError(e.message)); }, []);
  const playerId = account?.link?.player_id;
  const linkedPosition = account?.link?.position;
  useEffect(() => {
    if (!playerId) return;
    const controller = new AbortController();
    async function update() {
      try { const response = await fetch("/api/account/stats", { signal: controller.signal, cache: "no-store" }); const data = await response.json(); if (!response.ok) throw new Error(data.error); setTeams(data.teams); setStatsError(""); }
      catch (e) { if (!controller.signal.aborted) setStatsError(e instanceof Error ? e.message : "No se pudieron consultar tus estadísticas."); }
    }
    setTeams(null); void update(); const timer = setInterval(() => { if (!document.hidden) void update(); }, 60000);
    return () => { controller.abort(); clearInterval(timer); };
  }, [playerId, linkedPosition]);
  async function action(action: string, fields: object = {}) {
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/account", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...fields }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      if (action === "logout") { router.replace("/acceso"); router.refresh(); return; }
      await refreshAccount();
      setMessage(action === "link" ? "Ficha vinculada y posición aplicada a tus equipos." : action === "position" ? "Posición guardada en tus equipos." : "");
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo completar."); }
    finally { setBusy(false); }
  }
  if (account?.user?.role === "coach") return <CoachDashboard/>;
  if (account?.user?.role === "visitor") return <><PageHeading eyebrow="ESCUELA FITO RAYA" title="Cuenta de visitante." text="Consulta los equipos, las jornadas y las estadísticas del club."/><section className="panel account-card"><p>Este acceso no está asociado a ningún jugador.</p><Link href="/" className="button">Ver el club</Link></section></>;
  return <><PageHeading eyebrow="TU ESPACIO EN EL CLUB" title="Mi perfil." text="Tu jugador y lo que aportas a tu equipo."/>{error && <p className="snp-warning" role="alert">{error}</p>}{message && <p className="account-message" role="status">{message}</p>}
    {!account && !error && <p role="status">Comprobando tu sesión…</p>}
    {!account && error && <button className="button secondary" onClick={() => { setError(""); void refreshAccount().catch(e => setError(e.message)); }}>Volver a intentar</button>}
    {account && !account.user && <section className="panel account-card"><h2>Todo sobre tu temporada.</h2><p>Crea tu cuenta y elige tu ficha de jugador para ver tus estadísticas.</p><Link href="/acceso" className="button">Iniciar sesión o registrarme</Link></section>}
    {account?.user && <><section className="panel account-toolbar"><span>{account.user.email}</span><button className="button secondary" disabled={busy} onClick={() => void action("logout")}>Cerrar sesión</button></section>
      {!account.link ? <section className="panel account-card"><h2>Elige tu ficha de jugador</h2><p>Asocia tu cuenta a tu nombre en la plantilla para ver tus estadísticas.</p><form className="account-form" onSubmit={event => { event.preventDefault(); const values = new FormData(event.currentTarget); void action("link", { teamId: values.get("teamId"), playerId: values.get("playerId"), position }); }}><RosterChoice/><label>Tu posición<PositionOptions value={position} onChange={setPosition}/></label><button className="button" disabled={busy}>{busy ? "Guardando…" : "Asociar mi jugador"}</button></form></section>
      : <><section className="panel account-card"><div className="account-toolbar"><div><h2>Tu jugador</h2></div><button className="button secondary" disabled={busy} onClick={() => { if (window.confirm("¿Desvincular tu ficha SNP? Tu cuenta de esta web seguirá disponible.")) void action("unlink"); }}>Desvincular ficha</button></div><form className="account-form" onSubmit={e => { e.preventDefault(); void action("position", { position }); }}><label>Mi posición en pista<PositionOptions value={position} onChange={setPosition}/></label><p className="data-note">Al guardar sustituirás la posición actual en tus equipos. El entrenador podrá cambiarla después.</p><button className="button secondary" disabled={busy}>Guardar mi posición</button></form></section>
        <h2 className="account-section-title">Tu aportación esta temporada</h2>{statsError && <p className="snp-warning" role="status">{statsError}</p>}{teams === null && !statsError && <p role="status">Consultando las actas de tus equipos…</p>}{teams?.map(team => <section className="panel player-stats" key={team.id}><div className="panel-heading"><h2>Equipo {team.id.toUpperCase()}</h2><Link className="text-link" href={`/equipos/${team.id}/estadisticas`}>Ver ranking del equipo →</Link></div><div className="profile-metrics">{[[team.points, "Puntos para el equipo"], [team.played, "Partidos jugados"], [team.won, "Ganados"], [team.lost, "Perdidos"], [team.setsWon, "Sets ganados"], [team.setsLost, "Sets perdidos"]].map(([value, label]) => <div key={label}><strong>{value}</strong><span>{label}</span></div>)}</div><p className="data-note account-stat-note">{team.acts} actas consultadas. {team.partial && "Estadísticas parciales: hay actas o participaciones sin identificar. "}{team.stale && "Se muestran los últimos datos guardados. "}Posición actual: {team.position === "LEFT" ? "Revés" : team.position === "RIGHT" ? "Derecha" : team.position === "BOTH" ? "Ambos" : "Por confirmar"}.</p></section>)}{teams?.length === 0 && <p className="data-note">Tu ficha no aparece en las plantillas actuales del A o del B. Debajo puedes consultar tu historial SNP.</p>}<p className="data-note">Los puntos para el equipo se calculan con las actas de la fase actual. Cada jugador recibe los puntos que ganó su pareja; son distintos de los puntos de ranking SNP.</p><ExplorerPlayer id={account.link.player_id} hideBack/></>}
    </>}
  </>;
}
