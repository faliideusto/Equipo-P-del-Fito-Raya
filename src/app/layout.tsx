import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import "./globals.css";
import { connection } from "next/server";

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
export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await connection();

  return (
    <html lang="es">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
