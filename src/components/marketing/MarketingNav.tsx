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
    <header className="sticky top-0 z-50 border-b border-surface-border bg-canvas/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5 sm:px-8">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-surface-border bg-white text-xs font-semibold text-ink">
            R
          </span>
          <span className="text-sm font-medium tracking-tight text-ink">RuleCheck</span>
        </Link>
        <nav className="hidden items-center gap-7 text-sm font-medium text-ink-secondary md:flex">
          <Link href="/pricing" className="transition hover:text-ink">
            定價
          </Link>
          <Link href="/analyze" className="transition hover:text-ink">
            文案檢測
          </Link>
          {authed ? (
            <Link href="/dashboard" className="transition hover:text-ink">
              控制台
            </Link>
          ) : null}
        </nav>
        <div className="flex items-center gap-2">
          {authed ? (
            <Link
              href="/dashboard"
              className="inline-flex h-9 items-center justify-center rounded-lg border border-surface-border bg-white px-3 text-sm font-medium text-ink transition hover:bg-zinc-50"
            >
              進入控制台
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="inline-flex h-9 items-center justify-center rounded-lg px-3 text-sm font-medium text-ink-secondary transition hover:bg-white hover:text-ink"
              >
                登入
              </Link>
              <Link
                href="/signup"
                className="inline-flex h-9 items-center justify-center rounded-lg bg-brand-strong px-3 text-sm font-medium text-white transition hover:bg-brand-strong/90"
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
