export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-gradient-to-r from-zinc-200/50 via-zinc-100/80 to-zinc-200/50 ${className}`}
    />
  );
}
