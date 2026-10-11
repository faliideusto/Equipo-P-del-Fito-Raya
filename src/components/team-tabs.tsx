"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, LayoutGrid, ListOrdered, Medal, Sparkles, Users } from "lucide-react";
import type { TeamId } from "@/domain/types";

const tabs = [
  { slug: "", label: "Resumen", icon: LayoutGrid },
  { slug: "/jornadas", label: "Jornadas", icon: CalendarDays },
  { slug: "/clasificacion", label: "Clasificación", icon: ListOrdered },
  { slug: "/plantilla", label: "Plantilla", icon: Users },
  { slug: "/estadisticas", label: "Ranking", icon: Medal },
  { slug: "/parejas", label: "Crear parejas", icon: Sparkles },
];

export function TeamTabs({ teamId }: { teamId: TeamId }) {
  const pathname = usePathname();
  const base = `/equipos/${teamId}`;
  return (
    <nav className="team-tabs" aria-label={`Secciones del equipo ${teamId.toUpperCase()}`}>
      {tabs.map(({ slug, label, icon: Icon }) => {
        const href = base + slug;
        const active = slug ? pathname === href || pathname.startsWith(href + "/") : pathname === base;
        return (
          <Link key={href} href={href} className={`${active ? "active" : ""} ${slug === "/parejas" ? "is-action" : ""}`} aria-current={active ? "page" : undefined}>
            <Icon size={16} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

export function TeamSwitch({ teamId }: { teamId: TeamId }) {
  const pathname = usePathname();
  const other = teamId === "a" ? "b" : "a";
  const section = tabs.find(({ slug }) => slug && pathname.startsWith(`/equipos/${teamId}${slug}`))?.slug ?? "";
  return <Link className="team-switch" href={`/equipos/${other}${section}`}>Cambiar al equipo {other.toUpperCase()}</Link>;
}
