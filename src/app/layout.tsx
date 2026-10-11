import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { AppShell } from "@/components/app-shell";
import "./globals.css";
import { connection } from "next/server";

const display = localFont({
  src: [
    { path: "./fonts/saira-condensed-600.woff2", weight: "600" },
    { path: "./fonts/saira-condensed-700.woff2", weight: "700" },
    { path: "./fonts/saira-condensed-800.woff2", weight: "800" },
  ],
  variable: "--font-saira",
  display: "swap",
});
const body = localFont({ src: "./fonts/chivo.woff2", weight: "400 700", variable: "--font-chivo", display: "swap" });
const mono = localFont({ src: "./fonts/chivo-mono.woff2", weight: "400 600", variable: "--font-chivo-mono", display: "swap" });

export const metadata: Metadata = {
  title: {
    default: "Fito Raya · SNP Club House",
    template: "%s · Fito Raya SNP",
  },
  description:
    "Los equipos de Escuela Fito Raya. Plantillas, jornadas y laboratorio de alineaciones SNP.",
  icons: {
    icon: { url: "/logo-fito.png", type: "image/png" },
    apple: "/logo-fito.png",
  },
};
export const viewport: Viewport = { themeColor: "#0a1825", colorScheme: "dark" };
export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await connection();

  return (
    <html lang="es" data-scroll-behavior="smooth" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
