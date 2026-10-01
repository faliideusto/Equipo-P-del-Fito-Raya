"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageHeading } from "./sports";
export function CoachDashboard() {
  const router = useRouter(); const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(action: string, newPassword?: string) {
    setBusy(true); setMessage("");
    try {
      const response = await fetch(action === "logout" ? "/api/account" : "/api/lineups", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, newPassword }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      router.replace("/acceso"); router.refresh();
    } catch (e) { setMessage(e instanceof Error ? e.message : "No se pudo completar."); } finally { setBusy(false); }
  }
  return <><PageHeading eyebrow="FITO RAYA · ENTRENADOR" title="Tu equipo, en tus manos." text="Gestiona posiciones, alineaciones privadas y los MVP de cada equipo."/><div className="account-toolbar panel"><strong>Sesión de Fito Raya</strong><button className="button secondary" disabled={busy} onClick={() => void submit("logout")}>Cerrar sesión</button></div><div className="mvp-grid">{["a", "b"].map(team => <section className="panel account-card" key={team}><h2>Equipo {team.toUpperCase()}</h2><p>Posiciones, creación de parejas y archivo privado de alineaciones.</p><div className="position-editor-actions"><Link className="button" href={`/equipos/${team}/parejas`}>Gestionar alineaciones</Link><Link className="button secondary" href={`/equipos/${team}/parejas#positions-${team}`}>Editar posiciones</Link><Link className="button secondary" href={`/equipos/${team}/parejas#saved-lineups-${team}`}>Alineaciones guardadas</Link><Link className="text-link" href={`/equipos/${team}/estadisticas`}>Ver estadísticas →</Link></div></section>)}</div><section className="panel account-card"><h2>MVP del mes</h2><p>Elige o cambia el reconocimiento de cada equipo.</p><Link className="button" href="/mvp">Elegir MVP</Link></section><section className="panel account-card"><h2>Cambiar contraseña del entrenador</h2><p>Se cerrarán las sesiones anteriores. Después entra con fitoraya y tu nueva contraseña.</p><form className="account-form" onSubmit={e => { e.preventDefault(); const values = new FormData(e.currentTarget); if (values.get("newPassword") !== values.get("confirmation")) { setMessage("Las contraseñas no coinciden."); return; } void submit("change-password", String(values.get("newPassword"))); }}><label>Nueva contraseña<input name="newPassword" type="password" minLength={12} maxLength={128} autoComplete="new-password" required/></label><label>Repite la nueva contraseña<input name="confirmation" type="password" minLength={12} maxLength={128} autoComplete="new-password" required/></label><button className="button" disabled={busy}>Guardar nueva contraseña</button></form>{message && <p role="alert" className="snp-warning">{message}</p>}</section></>;
}
