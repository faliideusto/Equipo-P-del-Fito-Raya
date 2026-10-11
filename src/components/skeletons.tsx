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
