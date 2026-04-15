export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-xl bg-gradient-to-r from-surface-border/60 via-brand/5 to-surface-border/60 ${className}`}
    />
  );
}
