import Link from "next/link";
import { SignOutButton } from "@/components/SignOutButton";

const mobileLinks = [
  { href: "/dashboard", label: "總覽" },
  { href: "/analyze", label: "檢測" },
  { href: "/history", label: "紀錄" },
  { href: "/billing", label: "帳務" },
];

export function AppTopBar({ email }: { email?: string | null }) {
  return (
    <header className="flex h-16 flex-col border-b border-surface-border bg-white/80 backdrop-blur lg:flex-row lg:items-center lg:justify-between lg:px-6">
      <div className="flex h-16 items-center justify-between px-4 lg:contents lg:h-auto lg:px-0">
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/analyze" className="text-sm font-semibold text-ink lg:hidden">
            RuleCheck
          </Link>
          <p className="hidden truncate text-sm text-ink-secondary lg:block">
            {email ? <span className="text-ink">{email}</span> : null}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/"
            className="hidden rounded-lg px-2 py-1 text-sm text-ink-secondary transition hover:bg-brand/5 hover:text-ink sm:inline"
          >
            官網
          </Link>
          <SignOutButton />
        </div>
      </div>
      <nav className="flex gap-1 overflow-x-auto border-t border-surface-border px-2 py-2 lg:hidden">
        {mobileLinks.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium text-ink-secondary hover:bg-brand/5 hover:text-brand-strong"
          >
            {l.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
