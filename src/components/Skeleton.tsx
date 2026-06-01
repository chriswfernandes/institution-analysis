export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`bg-slate-200 animate-pulse rounded ${className}`} />
}
