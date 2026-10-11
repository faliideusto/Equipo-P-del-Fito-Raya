"use client";
import { useEffect, useState } from "react";
import { Wallet } from "lucide-react";
import { walletPlatforms, type WalletPlatform } from "@/domain/wallet-ui";
import type { TeamId } from "@/domain/types";
type WalletState = { apple: boolean; google: boolean; teams: TeamId[] };
// Hidden until the platform credentials exist and the player is on a roster.
export function WalletButtons() {
  const [state, setState] = useState<{ teams: TeamId[]; platforms: WalletPlatform[] } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/wallet", { signal: controller.signal, cache: "no-store" }).then(r => r.ok ? r.json() : null).then((data: WalletState | null) => { if (data) setState({ teams: data.teams, platforms: walletPlatforms(navigator.userAgent, data) }); }).catch(() => {});
    return () => controller.abort();
  }, []);
  if (!state || !state.teams.length || !state.platforms.length) return null;
  return <section className="panel wallet-panel">
    <div className="panel-heading"><h2><Wallet size={18} aria-hidden/> Tarjeta del equipo</h2></div>
    <div className="wallet-body">
      <p className="data-note">Añádela a tu móvil: verás el próximo partido, tu convocatoria, el último resultado y tus puntos SNP, y te avisará cuando el entrenador publique novedades.</p>
      <div className="wallet-buttons">{state.teams.flatMap(teamId => state.platforms.map(platform => <a key={`${teamId}-${platform}`} className="button secondary" href={`/api/wallet/${platform}?team=${teamId}`}>{platform === "apple" ? "Añadir a Apple Wallet" : "Guardar en Google Wallet"}{state.teams.length > 1 ? ` · Equipo ${teamId.toUpperCase()}` : ""}</a>))}</div>
    </div>
  </section>;
}
