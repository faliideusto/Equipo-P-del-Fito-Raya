import type { Metadata, Viewport } from "next";
import { Chivo, Chivo_Mono, Saira_Condensed } from "next/font/google";
import { AppShell } from "@/components/app-shell";
import "./globals.css";
import { connection } from "next/server";

const display = Saira_Condensed({ subsets: ["latin"], weight: ["600", "700", "800"], variable: "--font-saira", display: "swap" });
const body = Chivo({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-chivo", display: "swap" });
const mono = Chivo_Mono({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-chivo-mono", display: "swap" });

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
    <html lang="es" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
