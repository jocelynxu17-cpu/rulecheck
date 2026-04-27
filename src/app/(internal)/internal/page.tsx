import { fetchAdminHomeSnapshot } from "@/lib/admin/fetch-admin-home";
import { AdminHomeDashboard } from "@/components/admin/AdminHomeDashboard";
import { QaChecklistCard } from "@/components/admin/QaChecklistCard";

export default async function AdminPage() {
  const snapshot = await fetchAdminHomeSnapshot();

  return (
    <div className="space-y-12 pb-8">
      <div className="rounded-xl border border-dashed border-surface-border bg-canvas/30 px-4 py-3 text-sm leading-relaxed text-ink-secondary">
        <strong className="font-medium text-ink">系統摘要</strong>
        ：下列為精簡訊號與精選列；完整列表、篩選與原始事件請至{" "}
        <span className="text-ink">工作區／使用者／帳務／稽核</span> 等分頁，避免在總覽載入全系統資料。
      </div>
      <AdminHomeDashboard snapshot={snapshot} />
      <QaChecklistCard />
    </div>
  );
}
