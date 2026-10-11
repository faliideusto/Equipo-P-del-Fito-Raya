"use client";
import { useEffect, useState } from "react";
import { walletPlatforms, type WalletPlatform } from "@/domain/wallet-ui";
import type { TeamId } from "@/domain/types";
type WalletState = { apple: boolean; google: boolean; teams: TeamId[] };
// Small drawings in the spirit of each wallet app, not the official badges.
const ICONS: Record<WalletPlatform, React.ReactNode> = {
  apple: <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden><rect width="24" height="24" rx="5.5" fill="#111"/><rect x="4" y="5" width="16" height="4" rx="1.2" fill="#4aa8f0"/><rect x="4" y="8" width="16" height="4" rx="1.2" fill="#f7c843"/><rect x="4" y="11" width="16" height="4" rx="1.2" fill="#56c271"/><rect x="4" y="14" width="16" height="5" rx="1.2" fill="#ee5a50"/></svg>,
  google: <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden><rect width="24" height="24" rx="5.5" fill="#fff"/><clipPath id="wallet-google-clip"><rect x="4" y="5.5" width="16" height="13" rx="2.6"/></clipPath><g clipPath="url(#wallet-google-clip)"><rect x="4" y="5.5" width="16" height="13" fill="#4285f4"/><path d="M4 5.5h16v3.2L4 11.5z" fill="#34a853"/><path d="M4 5.5h16v1L4 8.7z" fill="#fbbc04"/><path d="M4 5.5h10L4 7z" fill="#ea4335"/></g></svg>,
};
const NAMES: Record<WalletPlatform, [string, string]> = { apple: ["Apple Wallet", "Añadir la tarjeta del equipo a Apple Wallet"], google: ["Google Wallet", "Guardar la tarjeta del equipo en Google Wallet"] };
// Two compact buttons for the SNP profile; hidden until the platform credentials exist and the player is on a roster.
export function WalletButtons() {
  const [state, setState] = useState<{ teams: TeamId[]; platforms: WalletPlatform[] } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/wallet", { signal: controller.signal, cache: "no-store" }).then(r => r.ok ? r.json() : null).then((data: WalletState | null) => { if (data) setState({ teams: data.teams, platforms: walletPlatforms(navigator.userAgent, data) }); }).catch(() => {});
    return () => controller.abort();
  }, []);
  if (!state || !state.teams.length || !state.platforms.length) return null;
  const many = state.teams.length > 1;
  return <div className="wallet-chips">{state.teams.flatMap(teamId => state.platforms.map(platform => {
    const [name, title] = NAMES[platform]; const team = many ? ` · ${teamId.toUpperCase()}` : "";
    return <a key={`${teamId}-${platform}`} className="wallet-chip" href={`/api/wallet/${platform}?team=${teamId}`} title={`${title}${many ? ` (equipo ${teamId.toUpperCase()})` : ""}`}>{ICONS[platform]}<span>{name}{team}</span></a>;
  }))}</div>;
}
