"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Navigation } from "./navigation";
import { LogoutButton } from "./logout-button";
const CoachContext = createContext(false);
export function useIsCoach() { return useContext(CoachContext); }
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname(); const access = pathname === "/acceso";
  const [identity, setIdentity] = useState<{ path: string; coach: boolean } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    if (!access) void fetch("/api/account", { signal: controller.signal, cache: "no-store" }).then(r => r.json()).then(data => setIdentity({ path: pathname, coach: data.user?.role === "coach" })).catch(() => {});
    return () => controller.abort();
  }, [pathname, access]);
  const coach = !access && identity?.path === pathname && identity.coach;
  return <CoachContext.Provider value={Boolean(coach)}>{!access && <Navigation isCoach={Boolean(coach)}/>}<main className={access ? "main access-main" : "main"}>{!access && <header className="topbar"><span>ESCUELA FITO RAYA <span className="topbar-divider">/</span> SERIES NACIONALES DE PÁDEL</span><div className="topbar-account"><span className="season"><span className="status-dot"/> TEMPORADA 26 / 27</span><LogoutButton/></div></header>}<div className="page-content">{children}</div><footer className="main-footer">Hecho para el equipo. Pensado para la pista.<span>FITO RAYA · SNP <b>Fuente original SNP</b></span></footer></main></CoachContext.Provider>;
}
