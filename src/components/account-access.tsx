"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RosterChoice } from "./roster-choice";
import { PageHeading } from "./sports";
import { PasswordField } from "./password-field";
export function AccountAccess() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup" | "recover" | "reset">("login");
  const [recoveryToken, setRecoveryToken] = useState("");
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState(""); const [error, setError] = useState("");
  useEffect(() => {
    // Email confirmation may return an implicit fragment. We do not retain it:
    // the user then signs in normally, with the server issuing HttpOnly cookies.
    if (window.location.hash) {
      const values = new URLSearchParams(window.location.hash.slice(1));
      const rejected = values.has("error");
      // A password recovery link carries a short-lived token, kept only in memory until the new password is saved.
      const token = values.get("type") === "recovery" ? values.get("access_token") : null;
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
      queueMicrotask(() => {
        if (rejected) setError("El enlace no es válido o ha caducado. Solicita otro.");
        else if (token) { setRecoveryToken(token); setMode("reset"); }
        else setMessage("Correo confirmado. Ya puedes iniciar sesión.");
      });
    }
  }, []);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    const form = event.currentTarget; const data = new FormData(form);
    try {
      if ((mode === "signup" || mode === "reset") && data.get("password") !== data.get("confirmation")) throw new Error("Las contraseñas no coinciden.");
      const response = await fetch("/api/account", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: mode, token: mode === "reset" ? recoveryToken : undefined, email: data.get("email"), password: data.get("password"), position: data.get("position"), teamId: data.get("teamId"), playerId: data.get("playerId"), registrationMode: data.get("registrationMode"), fullName: data.get("fullName"), searchPlayerId: data.get("searchPlayerId") }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error);
      form.reset();
      if (mode === "recover") { setMode("login"); setMessage("Si el correo está registrado, recibirás un enlace para elegir una nueva contraseña. Revisa también la carpeta de spam."); }
      else if (result.confirmation) { setMode("login"); setMessage("Revisa tu correo y pulsa el enlace de confirmación. Después entra aquí con tu contraseña. Si ya tenías cuenta, inicia sesión."); }
      else {
        if (mode === "reset") setRecoveryToken("");
        let destination = result.coach ? "/entrenador" : "/mi-perfil";
        const next = new URLSearchParams(window.location.search).get("next");
        if (mode === "login" && !result.coach && next?.startsWith("/")) {
          const target = new URL(next, window.location.origin);
          if (target.origin === window.location.origin && target.pathname !== "/acceso") destination = target.pathname + target.search;
        }
        router.replace(destination); router.refresh();
      }
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo acceder."); }
    finally { const password = form.elements.namedItem("password") as HTMLInputElement | null; if (password) password.value = ""; setBusy(false); }
  }
  const switchMode = (next: typeof mode) => { setMode(next); setError(""); setMessage(""); };
  const title = mode === "signup" ? "Crea tu cuenta." : mode === "recover" ? "Recupera tu contraseña." : mode === "reset" ? "Elige una nueva contraseña." : "Bienvenido a tu equipo.";
  const action = busy ? "Un momento…" : mode === "signup" ? "Crear mi cuenta" : mode === "recover" ? "Enviarme el enlace" : mode === "reset" ? "Guardar y entrar" : "Entrar";
  return <><PageHeading eyebrow="TU ESPACIO EN EL CLUB" title={title} text="Elige tu jugador de la plantilla y sigue tu temporada desde un solo lugar."/><section className="panel account-card">{(mode === "login" || mode === "signup") && <div className="profile-tabs"><button className={`button ${mode === "login" ? "" : "secondary"}`} disabled={busy} onClick={() => switchMode("login")}>Iniciar sesión</button><button className={`button ${mode === "signup" ? "" : "secondary"}`} disabled={busy} onClick={() => switchMode("signup")}>Crear cuenta</button></div>}{mode === "recover" && <p>Escribe el correo de tu cuenta y te enviaremos un enlace para elegir una nueva contraseña.</p>}{mode === "reset" && <p>Escribe la nueva contraseña para tu cuenta de esta web.</p>}<form method="post" onSubmit={submit} className="account-form">{mode !== "reset" && <label>{mode === "login" ? "Correo o usuario" : "Correo electrónico"}<input name="email" type={mode === "login" ? "text" : "email"} placeholder={mode === "login" ? "Tu correo" : "tu@email.com"} autoComplete="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} required maxLength={254}/></label>}{mode !== "recover" && <PasswordField key={mode} name="password" label={mode === "reset" ? "Nueva contraseña" : "Contraseña de esta web"} autoComplete={mode === "login" ? "current-password" : "new-password"} disabled={busy}/>}{mode === "login" && <button type="button" className="text-link account-link" disabled={busy} onClick={() => switchMode("recover")}>¿Has olvidado tu contraseña?</button>}{(mode === "signup" || mode === "reset") && <PasswordField name="confirmation" label="Repite la contraseña" autoComplete="new-password" disabled={busy}/>}{mode === "signup" && <><label>Tu posición en pista<PositionOptions/></label><RosterChoice allowAdditional/><p className="data-note">Aplicaremos esta posición a tus equipos. El entrenador podrá ajustarla después.</p></>}<button className="button" disabled={busy}>{action}</button>{(mode === "recover" || mode === "reset") && <button type="button" className="text-link account-link" disabled={busy} onClick={() => { setRecoveryToken(""); switchMode("login"); }}>← Volver a iniciar sesión</button>}</form>{error && <p className="snp-warning" role="alert">{error}</p>}{message && <p className="account-message" role="status">{message}</p>}{mode === "recover" ? <p className="data-note">El entrenador y la cuenta de visitante no usan este enlace: pide ayuda a Fito Raya.</p> : <p className="data-note">El registro no requiere iniciar sesión en SNP. El entrenador puede entrar con su usuario propio.</p>}</section></>;
}
export function PositionOptions({ value, onChange }: { value?: string; onChange?: (value: string) => void }) {
  return <select name="position" required defaultValue={value === undefined ? "" : undefined} value={value} onChange={onChange ? e => onChange(e.target.value) : undefined}><option value="" disabled>Selecciona tu posición</option><option value="RIGHT">Derecha</option><option value="LEFT">Revés</option><option value="BOTH">Ambos</option></select>;
}
