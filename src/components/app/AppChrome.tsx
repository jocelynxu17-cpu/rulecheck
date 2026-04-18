import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { AppSidebar } from "@/components/app/AppSidebar";
import { AppTopBar } from "@/components/app/AppTopBar";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { WorkspaceProvider } from "@/components/workspace/WorkspaceContext";

export function AppChrome({
  user,
  children,
}: {
  user: User | null;
  children: React.ReactNode;
}) {
  if (user) {
    return (
      <WorkspaceProvider>
        <div className="flex min-h-screen bg-canvas">
          <AppSidebar />
          <div className="flex min-w-0 flex-1 flex-col">
            <AppTopBar email={user.email} />
            <div className="flex-1 px-5 py-10 sm:px-8 lg:px-12 lg:py-12">{children}</div>
          </div>
        </div>
      </WorkspaceProvider>
    );
  }

  return (
    <div className="min-h-screen bg-canvas">
      <MarketingNav />
      <div className="mx-auto max-w-4xl px-5 pb-16 pt-10 sm:px-8">{children}</div>
      <div className="mx-auto flex max-w-4xl justify-center px-5 pb-10">
        <p className="text-center text-xs leading-relaxed text-ink-secondary">
          訪客模式：可使用 1 次免費檢測。
          <Link href="/signup" className="ml-1 font-medium text-ink underline-offset-4 hover:underline">
            註冊以解鎖紀錄與配額
          </Link>
        </p>
      </div>
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 px-5 pb-16 sm:flex-row sm:justify-center">
        <Link
          href="/login"
          className="inline-flex h-11 w-full items-center justify-center rounded-lg border border-surface-border bg-white px-6 text-sm font-medium text-ink transition hover:bg-zinc-50 sm:w-auto"
        >
          登入
        </Link>
        <Link
          href="/signup"
          className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-brand-strong px-6 text-sm font-medium text-white transition hover:bg-brand-strong/90 sm:w-auto"
        >
          建立帳號
        </Link>
      </div>
    </div>
  );
}
