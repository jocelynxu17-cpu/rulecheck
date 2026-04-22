import { fetchAdminHomeSnapshot } from "@/lib/admin/fetch-admin-home";
import { AdminHomeDashboard } from "@/components/admin/AdminHomeDashboard";
import { QaChecklistCard } from "@/components/admin/QaChecklistCard";

export default async function AdminPage() {
  const snapshot = await fetchAdminHomeSnapshot();

  return (
    <div className="space-y-12 pb-8">
      <AdminHomeDashboard snapshot={snapshot} />
      <QaChecklistCard />
    </div>
  );
}
