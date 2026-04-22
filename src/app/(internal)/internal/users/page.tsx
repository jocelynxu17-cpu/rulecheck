import Link from "next/link";
import { AdminPanel } from "@/components/admin/AdminPanel";
import { loadAdminLists } from "@/lib/admin/load-admin-lists";

export default async function InternalUsersPage() {
  const { workspaces, users, listError, usersError } = await loadAdminLists();
  const yymm = new Date().toISOString().slice(0, 7);

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-ink-secondary">內部營運</p>
        <h1 className="text-2xl font-medium tracking-tight text-ink sm:text-[1.625rem]">使用者</h1>
        <p className="max-w-2xl text-[15px] leading-relaxed text-ink-secondary">
          個人帳號層級欄位（與工作區帳務並存，便於對帳）。手動修復與額度調整請至{" "}
          <Link href="/internal" className="font-medium text-ink underline-offset-4 hover:underline">
            總覽 · 營運動作
          </Link>
          。
        </p>
      </div>

      <AdminPanel
        workspaces={workspaces}
        users={users}
        listError={listError}
        usersError={usersError}
        yymm={yymm}
        showWorkspaces={false}
        showUsers
        showManualAdjust={false}
      />
    </div>
  );
}
