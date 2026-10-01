"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeading } from "./sports";
export function AccountAccess() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState(""); const [error, setError] = useState("");
  useEffect(() => {
    // Email confirmation may return an implicit fragment. We do not retain it:
    // the user then signs in normally, with the server issuing HttpOnly cookies.
    if (window.location.hash) {
      const values = new URLSearchParams(window.location.hash.slice(1));
      const rejected = values.has("error");
      window.history.replaceState(null, "", window.location.pathname);
      queueMicrotask(() => {
        if (rejected) setError("El enlace no es válido o ha caducado. Solicita otro desde el registro.");
        else setMessage("Correo confirmado. Ya puedes iniciar sesión.");
      });
    }
  }, []);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    const form = event.currentTarget; const data = new FormData(form);
    try {
      if (mode === "signup" && data.get("password") !== data.get("confirmation")) throw new Error("Las contraseñas no coinciden.");
      const response = await fetch("/api/account", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: mode, email: data.get("email"), password: data.get("password"), position: data.get("position") }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error);
      form.reset();
      if (result.confirmation) { setMode("login"); setMessage("Revisa tu correo y pulsa el enlace de confirmación. Después entra aquí con tu contraseña. Si ya tenías cuenta, inicia sesión."); }
      else { router.push("/mi-perfil"); router.refresh(); }
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo acceder."); }
    finally { const password = form.elements.namedItem("password") as HTMLInputElement | null; if (password) password.value = ""; setBusy(false); }
  }
  return <><PageHeading eyebrow="TU ESPACIO EN EL CLUB" title={mode === "login" ? "Bienvenido a tu equipo." : "Crea tu cuenta."} text="Vincula tu ficha SNP y sigue tu temporada desde un solo lugar."/><section className="panel account-card"><div className="profile-tabs"><button className={`button ${mode === "login" ? "" : "secondary"}`} disabled={busy} onClick={() => { setMode("login"); setError(""); }}>Iniciar sesión</button><button className={`button ${mode === "signup" ? "" : "secondary"}`} disabled={busy} onClick={() => { setMode("signup"); setError(""); }}>Crear cuenta</button></div><form onSubmit={submit} className="account-form"><label>Correo electrónico<input name="email" type="email" autoComplete="email" required maxLength={254}/></label><label>Contraseña de esta web<input name="password" type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} minLength={mode === "signup" ? 12 : 1} maxLength={256} required/></label>{mode === "signup" && <><label>Repite la contraseña<input name="confirmation" type="password" autoComplete="new-password" minLength={12} maxLength={256} required/></label><label>Tu posición en pista<PositionOptions/></label><p className="data-note">Al vincular tu ficha SNP aplicaremos esta posición a tus equipos. El entrenador podrá ajustarla después. Usa una contraseña de al menos 12 caracteres.</p></>}<button className="button" disabled={busy}>{busy ? "Un momento…" : mode === "signup" ? "Crear mi cuenta" : "Entrar"}</button></form>{error && <p className="snp-warning" role="alert">{error}</p>}{message && <p className="account-message" role="status">{message}</p>}<p className="data-note">Esta cuenta es para la web de Fito Raya. Después podrás vincular tu acceso propio de SNP.</p></section></>;
}
export function PositionOptions({ value, onChange }: { value?: string; onChange?: (value: string) => void }) {
  return <select name="position" required defaultValue={value === undefined ? "" : undefined} value={value} onChange={onChange ? e => onChange(e.target.value) : undefined}><option value="" disabled>Selecciona tu posición</option><option value="RIGHT">Derecha</option><option value="LEFT">Revés</option><option value="BOTH">Ambos</option></select>;
}
