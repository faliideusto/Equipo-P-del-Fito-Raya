import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import type { ReactNode } from "react";
import type { WalletCardData } from "@/domain/wallet-card";
// The strip of the Apple pass (375x98 pt), drawn per card: Wallet fields allow neither icons nor a colour per text,
// so the match ("Fito Raya vs rival", date, time and venue) is an image on the kit gradient.
export const STRIP = { width: 375, height: 98 };
const BLUSH = "#FFE3F1", LILAC = "#E3D4FF", YELLOW = "#FFE066";
// Long rival names get a smaller title so most of them fit on one line; the rest end in "…".
export function titleSize(opponent: string): number {
  const length = `Fito Raya vs ${opponent}`.length;
  return length <= 26 ? 24 : length <= 32 ? 20 : 17;
}
type Icon = "ball" | "calendar" | "clock" | "home" | "away";
const PATHS: Record<Icon, ReactNode> = {
  ball: <><circle cx="12" cy="12" r="9" /><path d="M5.6 5.6c3.5 3.5 3.5 9.3 0 12.8M18.4 5.6c-3.5 3.5-3.5 9.3 0 12.8" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  home: <path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />,
  away: <path d="M5 12h14M13 6l6 6-6 6" />,
};
const icon = (name: Icon, size: number, color: string) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">{PATHS[name]}</svg>
);
function strip(card: WalletCardData, s: number) {
  const next = card.next;
  const details: [Icon, string][] = next ? [["calendar", next.day], ...(next.time ? [["clock", next.time] as [Icon, string]] : []), [next.venue === "Local" ? "home" : "away", next.venue]] : [];
  const title = next ? titleSize(next.opponent) * s : 20 * s;
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", gap: 5 * s, padding: `0 ${16 * s}px`, color: "#fff", fontFamily: "Geist", background: "linear-gradient(110deg, #C2287A 0%, #8E2A9E 55%, #4C1D95 100%)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 5 * s, fontSize: 10 * s, fontWeight: 600, letterSpacing: 0.6 * s, color: BLUSH }}>
        {icon("ball", 12 * s, BLUSH)}{next ? `${next.round} · PRÓXIMO PARTIDO` : "PRÓXIMO PARTIDO"}
      </div>
      {next ? (
        <div style={{ display: "flex", alignItems: "baseline", gap: 7 * s, fontSize: title, fontWeight: 700, lineHeight: 1.1, whiteSpace: "nowrap" }}>
          <span style={{ flexShrink: 0 }}>Fito Raya</span>
          <span style={{ flexShrink: 0, fontSize: title * 0.6, fontWeight: 600, fontStyle: "italic", color: LILAC }}>vs</span>
          <span style={{ color: YELLOW, overflow: "hidden", textOverflow: "ellipsis", flexShrink: 1, minWidth: 0 }}>{next.opponent}</span>
        </div>
      ) : <div style={{ display: "flex", fontSize: title, fontWeight: 700 }}>Sin partidos programados</div>}
      {details.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 14 * s, fontSize: 13 * s, fontWeight: 600 }}>
          {details.map(([name, text]) => <div key={name} style={{ display: "flex", alignItems: "center", gap: 5 * s }}>{icon(name, 13 * s, LILAC)}{text}</div>)}
        </div>
      )}
    </div>
  );
}
type Font = { name: string; data: Buffer; weight: 600 | 700; style: "normal" | "italic" };
let fonts: Promise<Font[]> | null = null;
function stripFonts(): Promise<Font[]> {
  const font = (file: string) => readFile(join(process.cwd(), "public", "wallet", "fonts", file));
  fonts ??= Promise.all([font("Geist-SemiBold.ttf"), font("Geist-Bold.ttf"), font("Geist-SemiBoldItalic.ttf")])
    .then(([semi, bold, italic]): Font[] => [{ name: "Geist", data: semi, weight: 600, style: "normal" }, { name: "Geist", data: bold, weight: 700, style: "normal" }, { name: "Geist", data: italic, weight: 600, style: "italic" }])
    .catch(error => { fonts = null; throw error; });
  return fonts;
}
// PNG of the strip at the given scale (2 → 750x196 px).
export async function renderStrip(card: WalletCardData, scale: number): Promise<Buffer> {
  const image = new ImageResponse(strip(card, scale), { width: STRIP.width * scale, height: STRIP.height * scale, fonts: await stripFonts() });
  return Buffer.from(await image.arrayBuffer());
}
