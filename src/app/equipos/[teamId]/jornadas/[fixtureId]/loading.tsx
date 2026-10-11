// Shown instantly while moving between matchdays; the team layout stays in place.
export default function FixtureLoading() {
  return <div className="fixture-loading" role="status" aria-live="polite">
    <span className="sr-only">Cargando jornada…</span>
    <div className="skeleton skeleton-line"/>
    <div className="skeleton skeleton-banner"/>
    <div className="skeleton skeleton-table"/>
  </div>;
}
