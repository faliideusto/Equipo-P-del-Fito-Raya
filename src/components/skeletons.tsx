// Loading placeholders shared by route loading.tsx files and client views, so every
// load in the app looks the same. Decorative blocks are hidden from assistive tech;
// the wrapper announces the load once.
export type SkeletonVariant = "page" | "table" | "cards" | "acta" | "profile";
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden="true"/>;
}
function Heading() {
  return <div className="skeleton-heading"><Skeleton className="skeleton-line skeleton-eyebrow"/><Skeleton className="skeleton-line skeleton-title"/></div>;
}
export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return <div className="skeleton-rows">{Array.from({ length: rows }, (_, i) => <Skeleton key={i} className="skeleton-row"/>)}</div>;
}
export function CardsSkeleton({ count = 6 }: { count?: number }) {
  return <div className="skeleton-cards">{Array.from({ length: count }, (_, i) => <Skeleton key={i} className="skeleton-card"/>)}</div>;
}
export function ProfileSkeleton() {
  return <div className="skeleton-profile"><div className="skeleton-profile-head"><Skeleton className="skeleton-avatar"/><div className="skeleton-profile-lines"><Skeleton className="skeleton-line skeleton-title"/><Skeleton className="skeleton-line skeleton-eyebrow"/></div></div><CardsSkeleton count={4}/><Skeleton className="skeleton-chart"/></div>;
}
export function PageSkeleton({ variant = "page", label = "Cargando…", heading = true }: { variant?: SkeletonVariant; label?: string; heading?: boolean }) {
  return <div className="page-skeleton" role="status" aria-live="polite">
    <span className="sr-only">{label}</span>
    {heading && <Heading/>}
    {variant === "page" && <><Skeleton className="skeleton-banner"/><CardsSkeleton count={3}/></>}
    {variant === "table" && <TableSkeleton rows={8}/>}
    {variant === "cards" && <CardsSkeleton/>}
    {variant === "acta" && <><Skeleton className="skeleton-banner"/><TableSkeleton rows={5}/></>}
    {variant === "profile" && <ProfileSkeleton/>}
  </div>;
}
// Mi perfil: skeletons built from the same containers as the real content, so the
// page keeps its shape while each part loads (no jumps between phases).
function MetricsSkeleton({ count, className = "" }: { count: number; className?: string }) {
  return <div className={`profile-metrics ${className}`}>{Array.from({ length: count }, (_, i) => <div key={i}><Skeleton className="skeleton-metric"/><Skeleton className="skeleton-line skeleton-eyebrow"/></div>)}</div>;
}
export function TeamStatsSkeleton() {
  return <div className="profile-teams"><section className="panel player-stats"><div className="panel-heading skeleton-panel-heading"><Skeleton className="skeleton-line skeleton-subtitle"/></div><MetricsSkeleton count={6}/></section></div>;
}
export function PlayerCardSkeleton() {
  return <>
    <section className="panel player-profile"><Skeleton className="skeleton-avatar skeleton-avatar-large"/><div className="skeleton-profile-lines"><Skeleton className="skeleton-line skeleton-subtitle"/><Skeleton className="skeleton-line skeleton-title"/><Skeleton className="skeleton-line skeleton-eyebrow"/><Skeleton className="skeleton-line skeleton-eyebrow"/></div></section>
    <MetricsSkeleton count={2} className="player-winrates"/>
    <div className="profile-tabs"><Skeleton className="skeleton-button"/><Skeleton className="skeleton-button"/></div>
    <section className="panel player-stats"><div className="panel-heading skeleton-panel-heading"><Skeleton className="skeleton-line skeleton-subtitle"/></div><MetricsSkeleton count={4}/><div className="points-chart"><Skeleton className="skeleton-chart"/></div></section>
  </>;
}
export function MyProfileSkeleton() {
  return <div role="status" aria-live="polite">
    <span className="sr-only">Cargando tu perfil…</span>
    <div className="section-title"><h2>Tu aportación esta temporada</h2><span>Puntos ganados para el equipo</span></div>
    <TeamStatsSkeleton/>
    <div className="section-title"><h2>Tu ficha SNP</h2><span>Puntos, ranking e historial deportivo</span></div>
    <PlayerCardSkeleton/>
  </div>;
}
