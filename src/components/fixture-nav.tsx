import Link from "next/link";
import type { Fixture } from "@/domain/types";
const label = (fixture: Fixture) => fixture.round === 1000 ? "Jornada de retos" : `Jornada ${fixture.round}`;
export function FixtureNav({ backHref, teamId, previous, next }: { backHref: string; teamId: string; previous: Fixture | null; next: Fixture | null }) {
  return <nav className="fixture-nav" aria-label="Navegación entre jornadas">
    <Link href={backHref} className="text-link">← Volver al calendario</Link>
    <div className="fixture-nav-steps">
      {previous && <Link href={`/equipos/${teamId}/jornadas/${previous.id}`} className="text-link" rel="prev" transitionTypes={["nav-back"]}>‹ {label(previous)}</Link>}
      {next && <Link href={`/equipos/${teamId}/jornadas/${next.id}`} className="text-link" rel="next" transitionTypes={["nav-forward"]}>{label(next)} ›</Link>}
    </div>
  </nav>;
}
