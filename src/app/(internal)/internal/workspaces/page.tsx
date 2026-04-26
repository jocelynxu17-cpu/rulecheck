import Link from "next/link";
import { AdminPanel } from "@/components/admin/AdminPanel";
import { loadAdminLists } from "@/lib/admin/load-admin-lists";

export default async function AdminWorkspacesPage() {
  const { workspaces, users, listError, usersError } = await loadAdminLists();
  const yymm = new Date().toISOString().slice(0, 7);

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-ink-secondary">內部營運</p>
        <h1 className="text-2xl font-medium tracking-tight text-ink sm:text-[1.625rem]">工作區</h1>
        <p className="max-w-2xl text-[15px] leading-relaxed text-ink-secondary">
          以工作區為客戶單位：成員、額度、方案與帳務。點名稱進入全景頁；手動修復亦可在該頁操作。
        </p>
      </div>

      <AdminPanel
        workspaces={workspaces}
        users={users}
        listError={listError}
        usersError={usersError}
        yymm={yymm}
        showWorkspaces
        showUsers={false}
        showManualAdjust={false}
      />
    </div>
  );
}
