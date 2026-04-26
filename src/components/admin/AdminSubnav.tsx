"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/internal", label: "總覽", match: "exact" as const },
  { href: "/internal/users", label: "用戶", match: "prefix" as const },
  { href: "/internal/workspaces", label: "工作區", match: "prefix" as const },
  { href: "/internal/analysis", label: "分析營運", match: "prefix" as const },
  { href: "/internal/payment-events", label: "帳務", match: "prefix" as const },
  { href: "/internal/audit", label: "稽核", match: "prefix" as const },
  { href: "/internal/security", label: "安全", match: "prefix" as const },
  { href: "/internal/settings", label: "設定", match: "prefix" as const },
  { href: "/internal/debug", label: "除錯工具", match: "prefix" as const },
];

export function AdminSubnav() {
  const pathname = usePathname();

  return (
    <nav
      className="-mx-1 mb-8 flex flex-wrap gap-1 border-b border-surface-border pb-3"
      aria-label="內部營運導覽"
    >
      {links.map((l) => {
        const active =
          l.match === "exact" ? pathname === l.href : pathname === l.href || pathname.startsWith(`${l.href}/`);
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`rounded-lg px-3 py-1.5 text-[13px] font-medium transition ${
              active
                ? "bg-white text-ink ring-1 ring-surface-border"
                : "text-ink-secondary hover:bg-white/70 hover:text-ink"
            }`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
