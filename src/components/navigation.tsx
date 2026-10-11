"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  ArrowUpRight,
  CalendarCheck,
  ClipboardList,
  HeartHandshake,
  House,
  Menu,
  Search,
  Trophy,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { SnpStatus } from "./snp-status";
import { LogoutButton } from "./logout-button";
import { RefreshDataButton } from "./refresh-data-button";

type Item = { href: string; label: string; icon: typeof House; detail?: string; match: (path: string) => boolean };
const teamItems: Item[] = (["a", "b"] as const).map((id) => ({
  href: `/equipos/${id}`,
  label: `Equipo ${id.toUpperCase()}`,
  detail: id === "a" ? "2ª División" : "10ª División",
  icon: Users,
  match: (path) => path === `/equipos/${id}` || path.startsWith(`/equipos/${id}/`),
}));
const clubItems: Item[] = [
  { href: "/competicion", label: "Competición", icon: Search, match: (path) => path.startsWith("/competicion") },
  { href: "/mvp", label: "MVP del mes", icon: Trophy, match: (path) => path === "/mvp" },
  { href: "/patrocinadores", label: "Patrocinadores", icon: HeartHandshake, match: (path) => path === "/patrocinadores" },
];
const home: Item = { href: "/", label: "Inicio", icon: House, match: (path) => path === "/" };
const profile: Item = { href: "/mi-perfil", label: "Mi perfil", icon: UserRound, match: (path) => path === "/mi-perfil" || path === "/acceso" };
const coach: Item = { href: "/entrenador", label: "Panel del entrenador", icon: ClipboardList, match: (path) => path === "/entrenador" };

function NavLink({ item, pathname, onNavigate }: { item: Item; pathname: string; onNavigate: () => void }) {
  const active = item.match(pathname);
  const Icon = item.icon;
  return (
    <Link className={`nav-link ${active ? "active" : ""}`} aria-current={active ? "page" : undefined} href={item.href} onClick={onNavigate}>
      <Icon size={18} />
      <span>{item.label}</span>
      {item.detail && <small>{item.detail}</small>}
    </Link>
  );
}

export function Navigation({ isCoach = false }: { isCoach?: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [latestHref, setLatestHref] = useState<string | null>(null);
  const close = () => setOpen(false);
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/fixtures/latest", { signal: controller.signal, cache: "no-store" }).then(r => r.ok ? r.json() : null).then(data => { if (typeof data?.href === "string") setLatestHref(data.href); }).catch(() => {});
    return () => controller.abort();
  }, []);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);
  const bottomItems = [home, ...teamItems, clubItems[0]];
  return (
    <>
      <div className="mobile-header" style={{ viewTransitionName: "app-mobile-header" }}>
        <Link href="/" className="mobile-brand" onClick={close}>
          <Image src="/logo-fito.png" alt="" width={36} height={36} />
          <span>Fito Raya</span>
        </Link>
        <div className="mobile-header-actions"><RefreshDataButton />
        <button className="mobile-menu" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="main-sidebar" aria-label={open ? "Cerrar menú" : "Abrir menú"}>
          {open ? <X size={20} /> : <Menu size={20} />}
          <span>Menú</span>
        </button></div>
      </div>
      <aside id="main-sidebar" className={`sidebar ${open ? "open" : ""}`} style={{ viewTransitionName: "app-sidebar" }}>
        <Link href="/" className="brand" onClick={close}>
          <Image src="/logo-fito.png" alt="Fito Raya Escuela de Pádel" width={48} height={48} priority />
          <span>
            Fito Raya <b>Club House SNP</b>
          </span>
        </Link>
        <nav aria-label="Navegación principal">
          <NavLink item={home} pathname={pathname} onNavigate={close} />
          <div className="nav-group">
            <div className="nav-caption">Nuestros equipos</div>
            {teamItems.map((item) => <NavLink key={item.href} item={item} pathname={pathname} onNavigate={close} />)}
            {/* A shortcut, not a section: styled apart and never marked as the current page. */}
            <Link className="nav-shortcut" href={latestHref ?? "/ultima-jornada"} onClick={close}><CalendarCheck size={18} /><span>Última jornada</span><ArrowUpRight size={16} className="nav-shortcut-arrow" /></Link>
          </div>
          <div className="nav-group">
            <div className="nav-caption">Club</div>
            {clubItems.map((item) => <NavLink key={item.href} item={item} pathname={pathname} onNavigate={close} />)}
          </div>
          <div className="nav-group">
            <div className="nav-caption">Tu cuenta</div>
            <NavLink item={profile} pathname={pathname} onNavigate={close} />
            {isCoach && <NavLink item={coach} pathname={pathname} onNavigate={close} />}
          </div>
        </nav>
        <div className="sidebar-footer">
          <span><span className="status-dot" /> Temporada 2026 / 27</span>
          <SnpStatus />
          <div className="sidebar-logout"><LogoutButton /></div>
        </div>
      </aside>
      {open && <button className="nav-backdrop" aria-label="Cerrar menú" onClick={close} />}
      <nav className="bottom-nav" aria-label="Accesos rápidos" style={{ viewTransitionName: "app-bottom-nav" }}>
        {bottomItems.map((item) => {
          const active = item.match(pathname);
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} className={active ? "active" : ""} aria-current={active ? "page" : undefined} onClick={close}>
              <Icon size={20} />
              <span>{item.label}</span>
            </Link>
          );
        })}
        <Link href={profile.href} className={profile.match(pathname) ? "active" : ""} aria-current={profile.match(pathname) ? "page" : undefined} onClick={close}>
          <UserRound size={20} />
          <span>Perfil</span>
        </Link>
      </nav>
    </>
  );
}
