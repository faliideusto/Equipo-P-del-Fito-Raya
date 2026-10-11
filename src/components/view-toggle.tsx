import Link from "next/link";
import { LayoutGrid, Table } from "lucide-react";

export type SquadView = "tabla" | "cartas";
export const squadView = (value: string | string[] | undefined): SquadView => value === "cartas" ? "cartas" : "tabla";

export function ViewToggle({ view, href }: { view: SquadView; href: string }) {
  return <nav className="view-toggle" aria-label="Vista">
    <Link href={href} scroll={false} replace aria-current={view === "tabla" ? "page" : undefined}><Table size={15}/>Tabla</Link>
    <Link href={`${href}?vista=cartas`} scroll={false} replace aria-current={view === "cartas" ? "page" : undefined}><LayoutGrid size={15}/>Cartas</Link>
  </nav>;
}
