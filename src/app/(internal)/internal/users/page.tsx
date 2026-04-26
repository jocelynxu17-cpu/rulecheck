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
        <h1 className="text-2xl font-medium tracking-tight text-ink sm:text-[1.625rem]">用戶</h1>
        <p className="max-w-2xl text-[15px] leading-relaxed text-ink-secondary">
          查帳號、所屬工作區數與內部權限。訂閱與額度以工作區為準時，請搭配{" "}
          <Link href="/internal/workspaces" className="font-medium text-ink underline-offset-4 hover:underline">
            工作區
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
