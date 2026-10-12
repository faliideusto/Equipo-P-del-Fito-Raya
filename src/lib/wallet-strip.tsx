import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import type { ReactNode } from "react";
import type { WalletCardData } from "@/domain/wallet-card";
// The strip of the Apple event ticket (375x98 pt), drawn per card: Wallet fields allow neither icons nor a colour per text,
// so the match ("Fito Raya vs rival", date, time and venue) and the player's lineup are an image on the kit gradient.
export const STRIP = { width: 375, height: 98 };
// The same drawing as the hero image of the Google card, 1032x336 px at 3x.
export const HERO = { width: 344, height: 112 };
const BLUSH = "#FFE3F1", LILAC = "#E3D4FF", YELLOW = "#FFE066";
// Long rival names get a smaller title so most of them fit on one line; the rest end in "…".
export function titleSize(opponent: string): number {
  const length = `Fito Raya vs ${opponent}`.length;
  return length <= 26 ? 22 : length <= 32 ? 18 : 15;
}
type Icon = "ball" | "calendar" | "clock" | "home" | "away" | "lineup" | "pin";
const PATHS: Record<Icon, ReactNode> = {
  ball: <><circle cx="12" cy="12" r="9" /><path d="M5.6 5.6c3.5 3.5 3.5 9.3 0 12.8M18.4 5.6c-3.5 3.5-3.5 9.3 0 12.8" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  home: <path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />,
  away: <path d="M5 12h14M13 6l6 6-6 6" />,
  pin: <><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" /><circle cx="12" cy="10" r="3" /></>,
  lineup: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
};
const icon = (name: Icon, size: number, color: string) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">{PATHS[name]}</svg>
);
// Icons, the round, the rival, the venue and the pair number are yellow; the rest is white.
// Away with a known place, the place (with a pin) replaces "Visitante" and ends in "…" if it does not fit.
function strip(card: WalletCardData, s: number) {
  const next = card.next;
  const details: [Icon, string, string][] = next ? [["calendar", next.day, "#fff"], ...(next.time ? [["clock", next.time, "#fff"] as [Icon, string, string]] : []), next.place ? ["pin", next.place, YELLOW] : [next.venue === "Local" ? "home" : "away", next.venue, YELLOW]] : [];
  const title = next ? titleSize(next.opponent) * s : 20 * s;
  // "Pareja 2 con Juan" shows the pair number in yellow; "Pendiente" or "No convocado" stay white.
  const [, pair, rest] = card.lineupShort.match(/^(Pareja \d+)(.*)$/) ?? [null, null, card.lineupShort];
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", gap: 4 * s, padding: `0 ${16 * s}px`, color: "#fff", fontFamily: "Geist", background: "linear-gradient(110deg, #C2287A 0%, #8E2A9E 55%, #4C1D95 100%)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 5 * s, fontSize: 9 * s, fontWeight: 600, letterSpacing: 0.6 * s, color: BLUSH }}>
        {icon("ball", 11 * s, YELLOW)}{next && <span style={{ color: YELLOW }}>{next.round}</span>}{next ? "· PRÓXIMO PARTIDO" : "PRÓXIMO PARTIDO"}
      </div>
      {next ? (
        <div style={{ display: "flex", alignItems: "baseline", gap: 7 * s, fontSize: title, fontWeight: 700, lineHeight: 1.1, whiteSpace: "nowrap" }}>
          <span style={{ flexShrink: 0 }}>Fito Raya</span>
          <span style={{ flexShrink: 0, fontSize: title * 0.6, fontWeight: 600, fontStyle: "italic", color: LILAC }}>vs</span>
          <span style={{ color: YELLOW, overflow: "hidden", textOverflow: "ellipsis", flexShrink: 1, minWidth: 0 }}>{next.opponent}</span>
        </div>
      ) : <div style={{ display: "flex", fontSize: title, fontWeight: 700 }}>Sin partidos programados</div>}
      {details.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 14 * s, fontSize: 12 * s, fontWeight: 600, whiteSpace: "nowrap" }}>
          {details.map(([name, text, color], index) => <div key={name} style={{ display: "flex", alignItems: "center", gap: 5 * s, color, flexShrink: index === details.length - 1 ? 1 : 0, minWidth: 0 }}><div style={{ display: "flex", flexShrink: 0 }}>{icon(name, 12 * s, YELLOW)}</div><span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{text}</span></div>)}
        </div>
      )}
      {next && (
        <div style={{ display: "flex", alignItems: "center", gap: 5 * s, fontSize: 12 * s, fontWeight: 600, whiteSpace: "nowrap" }}>
          {icon("lineup", 12 * s, YELLOW)}
          {pair && <span style={{ flexShrink: 0, color: YELLOW }}>{pair}</span>}
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>{rest.trim()}</span>
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
// PNG of the strip at the given scale (2 → 750x196 px), or of the Google hero with size HERO.
export async function renderStrip(card: WalletCardData, scale: number, size = STRIP): Promise<Buffer> {
  const image = new ImageResponse(strip(card, scale), { width: size.width * scale, height: size.height * scale, fonts: await stripFonts() });
  return Buffer.from(await image.arrayBuffer());
}
