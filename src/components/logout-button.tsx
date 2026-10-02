"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

export function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function logout() {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/account", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "logout" }) });
      if (!response.ok) throw new Error();
      router.replace("/acceso"); router.refresh();
    } catch { setError("No se pudo cerrar sesión. Inténtalo de nuevo."); setBusy(false); }
  }
  return <div className="session-actions"><button className="button secondary logout-button" disabled={busy} onClick={() => void logout()}><LogOut size={17}/>{busy ? "Saliendo…" : "Cerrar sesión"}</button>{error && <span role="alert">{error}</span>}</div>;
}
