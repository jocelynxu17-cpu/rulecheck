import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  billingProviderLabelZh,
  subscriptionStatusLabelZh,
} from "@/lib/billing/subscription-state";

type AdminWorkspaceRow = {
  id: string;
  name: string;
  plan: string | null;
  subscription_status: string | null;
  billing_provider: string | null;
  cancel_at_period_end: boolean | null;
  monthly_quota_units: number;
  units_used_month: number;
  usage_month: string;
  created_at: string;
};

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const admins =
    process.env.ADMIN_EMAILS?.split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean) ?? [];
  const allowed = admins.length === 0 || (user?.email && admins.includes(user.email.toLowerCase()));

  if (!allowed) {
    return (
      <div className="mx-auto max-w-lg py-10">
        <Card>
          <CardHeader>
            <CardTitle>無法存取</CardTitle>
            <CardDescription>此頁面僅限管理者。請聯絡產品管理員開通 ADMIN_EMAILS。</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  let workspaces: AdminWorkspaceRow[] = [];
  let listError: string | null = null;

  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const admin = createAdminClient();
      const { data, error } = await admin
        .from("workspaces")
        .select(
          "id, name, plan, subscription_status, billing_provider, cancel_at_period_end, monthly_quota_units, units_used_month, usage_month, created_at"
        )
        .order("created_at", { ascending: false })
        .limit(80);
      if (error) listError = error.message;
      else workspaces = (data ?? []) as AdminWorkspaceRow[];
    } catch (e) {
      listError = e instanceof Error ? e.message : "無法建立管理連線";
    }
  } else {
    listError = "未設定 SUPABASE_SERVICE_ROLE_KEY，無法載入工作區列表。";
  }

  const yymm = new Date().toISOString().slice(0, 7);

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">管理後台</h1>
        <Badge tone="amber">Beta</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>工作區（共用帳務 SSOT）</CardTitle>
          <CardDescription>
            方案、訂閱與審查額度以工作區為準。週期資料後續可寫入{" "}
            <code className="rounded bg-surface px-1 py-0.5 text-xs">subscriptions</code> /{" "}
            <code className="rounded bg-surface px-1 py-0.5 text-xs">payment_events</code>。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {listError ? (
            <p className="text-sm text-amber-900">{listError}</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-surface-border">
              <table className="w-full min-w-[900px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-surface-border bg-surface/80 text-xs font-semibold uppercase tracking-wide text-ink-secondary">
                    <th className="px-4 py-3">工作區</th>
                    <th className="px-4 py-3">方案</th>
                    <th className="px-4 py-3">訂閱狀態</th>
                    <th className="px-4 py-3">帳務來源</th>
                    <th className="px-4 py-3">審查額度</th>
                    <th className="px-4 py-3">本月已用</th>
                    <th className="px-4 py-3">週期末取消</th>
                  </tr>
                </thead>
                <tbody>
                  {workspaces.map((w) => {
                    const used = w.usage_month === yymm ? w.units_used_month : 0;
                    return (
                      <tr key={w.id} className="border-b border-surface-border/80 last:border-0">
                        <td className="max-w-[200px] truncate px-4 py-3 font-medium text-ink">{w.name}</td>
                        <td className="px-4 py-3 text-ink-secondary">{w.plan ?? "—"}</td>
                        <td className="px-4 py-3 text-ink-secondary">{subscriptionStatusLabelZh(w.subscription_status)}</td>
                        <td className="px-4 py-3 text-ink-secondary">{billingProviderLabelZh(w.billing_provider) ?? "—"}</td>
                        <td className="px-4 py-3 text-ink-secondary">{w.monthly_quota_units}</td>
                        <td className="px-4 py-3 text-ink-secondary">{used}</td>
                        <td className="px-4 py-3 text-ink-secondary">{w.cancel_at_period_end ? "是" : "否"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>功能規劃中</CardTitle>
          <CardDescription>
            我們正在整理管理者需要的工作流：帳號與權限、稽核紀錄、詞庫版本控管與營運監控。上線初期不影響一般使用者功能。
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-ink-secondary">
          <p>若你需要企業級管理需求，歡迎透過產品內聯絡方式與我們討論。</p>
        </CardContent>
      </Card>
    </div>
  );
}
