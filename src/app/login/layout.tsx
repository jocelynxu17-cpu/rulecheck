import Link from "next/link";

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-canvas px-5 py-12 sm:px-8">
      <div className="mx-auto mb-10 flex max-w-md items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 text-sm font-medium text-ink">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-surface-border bg-white text-xs font-semibold text-ink">
            R
          </span>
          RuleCheck
        </Link>
        <Link href="/pricing" className="text-sm font-medium text-ink-secondary transition hover:text-ink">
          定價
        </Link>
      </div>
      <div className="mx-auto max-w-md">{children}</div>
    </div>
  );
}
