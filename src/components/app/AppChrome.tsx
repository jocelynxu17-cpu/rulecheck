import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { AppSidebar } from "@/components/app/AppSidebar";
import { AppTopBar } from "@/components/app/AppTopBar";
import { MarketingNav } from "@/components/marketing/MarketingNav";

export function AppChrome({
  user,
  children,
}: {
  user: User | null;
  children: React.ReactNode;
}) {
  if (user) {
    return (
      <div className="flex min-h-screen bg-page-gradient">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <AppTopBar email={user.email} />
          <div className="flex-1 px-4 py-8 sm:px-6 lg:px-10">{children}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-page-gradient">
      <MarketingNav />
      <div className="mx-auto max-w-4xl px-4 pb-16 pt-8 sm:px-6">{children}</div>
      <div className="mx-auto flex max-w-4xl justify-center px-4 pb-10">
        <p className="text-center text-xs text-ink-secondary">
          訪客模式：可使用 1 次免費檢測。
          <Link href="/signup" className="ml-1 font-medium text-brand-strong hover:underline">
            註冊以解鎖紀錄與配額
          </Link>
        </p>
      </div>
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 px-4 pb-16 sm:flex-row sm:justify-center">
        <Link
          href="/login"
          className="inline-flex h-12 w-full items-center justify-center rounded-xl border border-surface-border bg-white px-6 text-sm font-medium text-ink shadow-sm transition hover:border-brand/40 sm:w-auto"
        >
          登入
        </Link>
        <Link
          href="/signup"
          className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-gradient-to-br from-[#B8D9FF] via-brand to-brand-strong px-6 text-sm font-semibold text-white shadow-soft transition hover:brightness-[1.03] sm:w-auto"
        >
          建立帳號
        </Link>
      </div>
    </div>
  );
}
