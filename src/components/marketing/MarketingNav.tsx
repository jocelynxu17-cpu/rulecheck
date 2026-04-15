import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export async function MarketingNav() {
  let authed = false;
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    authed = Boolean(data.user);
  } catch {
    authed = false;
  }

  return (
    <header className="sticky top-0 z-50 border-b border-surface-border/80 bg-white/75 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#B8D9FF] to-brand shadow-soft">
            <span className="text-sm font-bold text-white">R</span>
          </span>
          <span className="text-sm font-semibold tracking-tight text-ink">RuleCheck</span>
        </Link>
        <nav className="hidden items-center gap-8 text-sm font-medium text-ink-secondary md:flex">
          <Link href="/pricing" className="transition hover:text-brand-strong">
            定價
          </Link>
          <Link href="/analyze" className="transition hover:text-brand-strong">
            文案檢測
          </Link>
          {authed ? (
            <Link href="/dashboard" className="transition hover:text-brand-strong">
              控制台
            </Link>
          ) : null}
        </nav>
        <div className="flex items-center gap-2">
          {authed ? (
            <Link
              href="/dashboard"
              className="inline-flex h-9 items-center justify-center rounded-xl border border-surface-border bg-white px-3 text-sm font-medium text-ink shadow-sm transition hover:border-brand/40"
            >
              進入控制台
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="inline-flex h-9 items-center justify-center rounded-xl px-3 text-sm font-medium text-ink-secondary transition hover:bg-brand/5 hover:text-ink"
              >
                登入
              </Link>
              <Link
                href="/signup"
                className="inline-flex h-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#B8D9FF] via-brand to-brand-strong px-3 text-sm font-semibold text-white shadow-soft transition hover:brightness-[1.03]"
              >
                免費開始
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
