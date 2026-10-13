import Link from "next/link";
import { CalendarDays, LayoutGrid, List, Table } from "lucide-react";

export type SquadView = "tabla" | "cartas";
export const squadView = (value: string | string[] | undefined): SquadView => value === "cartas" ? "cartas" : "tabla";

export function ViewToggle({ view, href }: { view: SquadView; href: string }) {
  return <nav className="view-toggle" aria-label="Vista">
    <Link href={href} scroll={false} replace aria-current={view === "tabla" ? "page" : undefined}><Table size={15}/>Tabla</Link>
    <Link href={`${href}?vista=cartas`} scroll={false} replace aria-current={view === "cartas" ? "page" : undefined}><LayoutGrid size={15}/>Cartas</Link>
  </nav>;
}

export type ScheduleView = "lista" | "calendario";
export const scheduleView = (value: string | string[] | undefined): ScheduleView => value === "calendario" ? "calendario" : "lista";

export function ScheduleViewToggle({ view, href }: { view: ScheduleView; href: string }) {
  return <nav className="view-toggle" aria-label="Vista">
    <Link href={href} scroll={false} replace aria-current={view === "lista" ? "page" : undefined}><List size={15}/>Lista</Link>
    <Link href={`${href}?vista=calendario`} scroll={false} replace aria-current={view === "calendario" ? "page" : undefined}><CalendarDays size={15}/>Calendario</Link>
  </nav>;
}
