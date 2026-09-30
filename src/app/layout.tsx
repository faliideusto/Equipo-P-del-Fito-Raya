import type { Metadata } from "next";
import { Navigation } from "@/components/navigation";
import "./globals.css";
import { connection } from "next/server";
export const metadata: Metadata = {
  title: {
    default: "Fito Raya · SNP Club House",
    template: "%s · Fito Raya SNP",
  },
  description:
    "Los equipos de Escuela Fito Raya. Plantillas, jornadas y laboratorio de alineaciones SNP.",
  icons: { icon: "/icon.svg" },
};
export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await connection();
  return (
    <html lang="es">
      <body>
        <Navigation />
        <main className="main">
          <header className="topbar">
            <span>
              ESCUELA FITO RAYA <span className="topbar-divider">/</span> SERIES
              NACIONALES DE PÁDEL
            </span>
            <span className="season">
              <span className="status-dot" /> TEMPORADA 26 / 27
            </span>
          </header>
          <div className="page-content">{children}</div>
          <footer className="main-footer">
            Hecho para el equipo. Pensado para la pista.
            <span>
              FITO RAYA · SNP <b>Fuente original SNP</b>
            </span>
          </footer>
        </main>
      </body>
    </html>
  );
}
