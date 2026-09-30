"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  ArrowUpRight,
  CalendarDays,
  House,
  HeartHandshake,
  Layers3,
  Trophy,
  Users,
  X,
  Menu,
} from "lucide-react";
import { useState } from "react";
import { SnpStatus } from "./snp-status";
const sections = [
  { slug: "", label: "Resumen", icon: Layers3 },
  { slug: "/clasificacion", label: "Clasificación", icon: Trophy },
  { slug: "/jornadas", label: "Jornadas", icon: CalendarDays },
  { slug: "/plantilla", label: "Plantilla", icon: Users },
  { slug: "/estadisticas", label: "Ranking temporada", icon: Trophy },
  { slug: "/parejas", label: "Crear parejas", icon: ArrowUpRight },
];
export function Navigation() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        className="mobile-menu"
        onClick={() => setOpen(!open)}
        aria-label={open ? "Cerrar navegación" : "Abrir navegación"}
      >
        {open ? <X /> : <Menu />}
      </button>
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <Link href="/" className="brand" onClick={() => setOpen(false)}>
          <Image
            src="/logo-fito.png"
            alt="Fito Raya Escuela de Pádel"
            width={112}
            height={98}
            priority
          />
          <span>
            SNP <b>CLUB HOUSE</b>
          </span>
        </Link>
        <nav aria-label="Navegación principal">
          <Link
            className={`nav-link ${pathname === "/" ? "active" : ""}`}
            href="/"
            onClick={() => setOpen(false)}
          >
            <House size={18} /> Inicio
          </Link>
          <Link className={`nav-link ${pathname === "/mvp" ? "active" : ""}`} href="/mvp" onClick={() => setOpen(false)}><Trophy size={18} /> MVP</Link>
          <Link className={`nav-link ${pathname === "/patrocinadores" ? "active" : ""}`} href="/patrocinadores" onClick={() => setOpen(false)}><HeartHandshake size={18} /> Patrocinadores</Link>
          {(["a", "b"] as const).map((id) => (
            <div className="nav-group" key={id}>
              <div className="nav-caption">
                ESCUELA FITO RAYA <span>{id.toUpperCase()}</span>
              </div>
              {sections.map(({ slug, label, icon: Icon }) => {
                const href = `/equipos/${id}${slug}`;
                return (
                  <Link
                    key={href}
                    className={`nav-link ${pathname === href || (slug === "/jornadas" && pathname.startsWith(href)) ? "active" : ""}`}
                    href={href}
                    onClick={() => setOpen(false)}
                  >
                    <Icon size={18} />
                    {label}
                    {slug === "/parejas" && <span className="mini-dot" />}
                  </Link>
                );
              })}
            </div>
          ))}
          <div className="nav-group">
            <div className="nav-caption">EXPLORAR SNP</div>
            <Link className={`nav-link ${pathname.startsWith("/competicion") ? "active" : ""}`} href="/competicion" onClick={() => setOpen(false)}><Trophy size={18} /> Competición</Link>
          </div>
        </nav>
        <div className="sidebar-footer">
          <span className="status-dot" /> Temporada 2026 / 27
          <SnpStatus />
        </div>
      </aside>
      {open && (
        <button
          className="nav-backdrop"
          aria-label="Cerrar navegación"
          onClick={() => setOpen(false)}
        />
      )}
    </>
  );
}
