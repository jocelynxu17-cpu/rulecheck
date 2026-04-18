import Link from "next/link";
import { SignOutButton } from "@/components/SignOutButton";
import { WorkspaceSwitcher } from "@/components/workspace/WorkspaceSwitcher";

const mobileLinks = [
  { href: "/dashboard", label: "總覽" },
  { href: "/analyze", label: "檢測" },
  { href: "/history", label: "紀錄" },
  { href: "/team", label: "成員" },
  { href: "/billing", label: "帳務" },
];

export function AppTopBar({ email }: { email?: string | null }) {
  return (
    <header className="flex h-14 flex-col border-b border-surface-border bg-canvas/90 backdrop-blur-md lg:flex-row lg:items-center lg:justify-between lg:px-6">
      <div className="flex h-14 items-center justify-between px-4 lg:contents lg:h-auto lg:px-0">
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/analyze" className="text-sm font-medium text-ink lg:hidden">
            RuleCheck
          </Link>
          <WorkspaceSwitcher />
          <p className="hidden max-w-[240px] truncate text-xs text-ink-secondary lg:block">
            {email ? <span className="text-ink">{email}</span> : null}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Link
            href="/"
            className="hidden rounded-md px-2.5 py-1.5 text-xs font-medium text-ink-secondary transition hover:bg-white hover:text-ink sm:inline"
          >
            官網
          </Link>
          <SignOutButton />
        </div>
      </div>
      <nav className="flex gap-0.5 overflow-x-auto border-t border-surface-border px-2 py-2 lg:hidden">
        {mobileLinks.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="shrink-0 rounded-md px-3 py-1.5 text-[11px] font-medium text-ink-secondary transition hover:bg-white hover:text-ink"
          >
            {l.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
