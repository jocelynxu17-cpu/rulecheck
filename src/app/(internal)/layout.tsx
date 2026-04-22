import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { canAccessInternalOps } from "@/lib/admin/internal-ops-access";
import { SignOutButton } from "@/components/SignOutButton";

/** 內部營運 App 外殼：僅具內部營運權限者可進入。 */
export default async function InternalAppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent("/internal")}`);
  }

  if (!canAccessInternalOps(user.email)) {
    redirect("/analyze");
  }

  return (
    <div className="min-h-screen bg-[#f4f4f5] text-ink">
      <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-12 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/internal" className="text-sm font-semibold tracking-tight text-ink">
            RuleCheck <span className="text-ink-secondary">· 內部營運</span>
          </Link>
          <div className="flex items-center gap-3 text-xs text-ink-secondary">
            <span className="hidden max-w-[200px] truncate sm:inline">{user.email}</span>
            <Link
              href="/analyze"
              className="font-medium text-ink underline-offset-4 hover:underline"
            >
              返回產品
            </Link>
            <SignOutButton />
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">{children}</div>
    </div>
  );
}
