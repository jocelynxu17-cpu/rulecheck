"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

type Props = {
  userId: string;
  initialMonthlyAnalysisQuota: number;
  initialPlan: string | null;
  initialSubscriptionStatus: string | null;
  initialCurrentPeriodEndIso: string | null;
  initialCancelAtPeriodEnd: boolean | null;
  initialBillingProvider: string | null;
};

function isoToDatetimeLocalValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function InternalUserOpsCard({
  userId,
  initialMonthlyAnalysisQuota,
  initialPlan,
  initialSubscriptionStatus,
  initialCurrentPeriodEndIso,
  initialCancelAtPeriodEnd,
  initialBillingProvider,
}: Props) {
  const router = useRouter();
  const [quota, setQuota] = useState(String(initialMonthlyAnalysisQuota));
  const [plan, setPlan] = useState(initialPlan ?? "");
  const [subscriptionStatus, setSubscriptionStatus] = useState(initialSubscriptionStatus ?? "");
  const [periodLocal, setPeriodLocal] = useState(isoToDatetimeLocalValue(initialCurrentPeriodEndIso));
  const [cancelEnd, setCancelEnd] = useState(Boolean(initialCancelAtPeriodEnd));
  const [billingProvider, setBillingProvider] = useState(initialBillingProvider ?? "");
  const [overrideNote, setOverrideNote] = useState("");
  const [quotaSaving, setQuotaSaving] = useState(false);
  const [planSaving, setPlanSaving] = useState(false);
  const [statusSaving, setStatusSaving] = useState(false);
  const [periodSaving, setPeriodSaving] = useState(false);
  const [cancelSaving, setCancelSaving] = useState(false);
  const [providerSaving, setProviderSaving] = useState(false);
  const [overrideSaving, setOverrideSaving] = useState(false);

  async function patchUser(payload: Record<string, unknown>) {
    const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}`, {
      method: "PATCH",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = (await res.json()) as { ok?: boolean; error?: string };
    if (!res.ok || body.ok === false) {
      toast.error("更新失敗", { description: body.error ?? `HTTP ${res.status}` });
      return false;
    }
    toast.success("已更新並寫入稽核");
    router.refresh();
    return true;
  }

  async function saveQuota() {
    const q = Number.parseInt(quota.trim(), 10);
    if (!Number.isFinite(q)) {
      toast.error("請輸入整數額度。");
      return;
    }
    setQuotaSaving(true);
    try {
      await patchUser({ monthly_analysis_quota: q });
    } finally {
      setQuotaSaving(false);
    }
  }

  async function savePlan() {
    const p = plan.trim();
    if (!p) {
      toast.error("請輸入方案字串。");
      return;
    }
    setPlanSaving(true);
    try {
      await patchUser({ plan: p });
    } finally {
      setPlanSaving(false);
    }
  }

  async function saveSubscriptionStatus() {
    setStatusSaving(true);
    try {
      const raw = subscriptionStatus.trim();
      const payload = raw === "" || raw === "-" ? { subscription_status: null } : { subscription_status: raw };
      await patchUser(payload);
    } finally {
      setStatusSaving(false);
    }
  }

  async function savePeriodEnd() {
    setPeriodSaving(true);
    try {
      const raw = periodLocal.trim();
      const payload = raw === "" ? { current_period_end: null } : { current_period_end: new Date(raw).toISOString() };
      if (raw !== "" && Number.isNaN(Date.parse(raw))) {
        toast.error("時間格式不正確。");
        return;
      }
      await patchUser(payload);
    } finally {
      setPeriodSaving(false);
    }
  }

  async function saveCancelEnd() {
    setCancelSaving(true);
    try {
      await patchUser({ cancel_at_period_end: cancelEnd });
    } finally {
      setCancelSaving(false);
    }
  }

  async function saveBillingProvider() {
    setProviderSaving(true);
    try {
      const raw = billingProvider.trim();
      await patchUser({ billing_provider: raw === "" || raw === "-" ? null : raw });
    } finally {
      setProviderSaving(false);
    }
  }

  async function saveManualOverride() {
    const note = overrideNote.trim();
    if (note.length < 4) {
      toast.error("註記至少 4 字。");
      return;
    }
    setOverrideSaving(true);
    try {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/manual-override`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note }),
      });
      const body = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || body.ok === false) {
        toast.error("寫入失敗", { description: body.error ?? `HTTP ${res.status}` });
        return;
      }
      toast.success("手動覆寫已記錄於稽核");
      setOverrideNote("");
      router.refresh();
    } finally {
      setOverrideSaving(false);
    }
  }

  return (
    <Card className="border-surface-border">
      <CardHeader>
        <CardTitle className="text-base">內部營運動作</CardTitle>
        <CardDescription>
          變更寫入 <code className="font-mono text-[11px]">public.users</code> 並逐欄寫入稽核。請與工作區帳務摘要交叉驗證。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        <div className="space-y-4">
          <p className="text-sm font-medium text-ink">個人層級額度與方案</p>
          <div className="flex max-w-md flex-col gap-2 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1 space-y-1.5">
              <label className="text-xs font-medium text-ink-secondary" htmlFor={`u-quota-${userId}`}>
                monthly_analysis_quota
              </label>
              <Input
                id={`u-quota-${userId}`}
                inputMode="numeric"
                value={quota}
                onChange={(e) => setQuota(e.target.value)}
                className="font-mono text-sm"
              />
            </div>
            <Button type="button" className="rounded-xl sm:shrink-0" disabled={quotaSaving} onClick={() => void saveQuota()}>
              {quotaSaving ? "儲存中…" : "儲存額度"}
            </Button>
          </div>

          <div className="flex max-w-md flex-col gap-2 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1 space-y-1.5">
              <label className="text-xs font-medium text-ink-secondary" htmlFor={`u-plan-${userId}`}>
                plan
              </label>
              <Input
                id={`u-plan-${userId}`}
                value={plan}
                onChange={(e) => setPlan(e.target.value)}
                className="font-mono text-sm"
              />
            </div>
            <Button type="button" className="rounded-xl sm:shrink-0" disabled={planSaving} onClick={() => void savePlan()}>
              {planSaving ? "儲存中…" : "儲存方案"}
            </Button>
          </div>

          <div className="flex max-w-md flex-col gap-2 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1 space-y-1.5">
              <label className="text-xs font-medium text-ink-secondary" htmlFor={`u-sub-${userId}`}>
                subscription_status（空＝清除）
              </label>
              <Input
                id={`u-sub-${userId}`}
                value={subscriptionStatus}
                onChange={(e) => setSubscriptionStatus(e.target.value)}
                className="font-mono text-sm"
              />
            </div>
            <Button
              type="button"
              className="rounded-xl sm:shrink-0"
              disabled={statusSaving}
              onClick={() => void saveSubscriptionStatus()}
            >
              {statusSaving ? "儲存中…" : "儲存訂閱狀態"}
            </Button>
          </div>
        </div>

        <div className="border-t border-surface-border/80 pt-6 space-y-4">
          <p className="text-sm font-medium text-ink">計費快照欄位（使用者列）</p>
          <div className="max-w-md space-y-1.5">
            <label className="text-xs font-medium text-ink-secondary" htmlFor={`u-period-${userId}`}>
              current_period_end（本地時間選擇，留空＝清除）
            </label>
            <Input
              id={`u-period-${userId}`}
              type="datetime-local"
              value={periodLocal}
              onChange={(e) => setPeriodLocal(e.target.value)}
              className="font-mono text-sm"
            />
            <Button type="button" className="rounded-xl" disabled={periodSaving} onClick={() => void savePeriodEnd()}>
              {periodSaving ? "儲存中…" : "儲存週期結束"}
            </Button>
          </div>

          <div className="flex max-w-md items-center gap-3 pt-2">
            <input
              id={`u-cancel-${userId}`}
              type="checkbox"
              checked={cancelEnd}
              onChange={(e) => setCancelEnd(e.target.checked)}
              className="h-4 w-4 rounded border-surface-border"
            />
            <label htmlFor={`u-cancel-${userId}`} className="text-sm text-ink">
              cancel_at_period_end
            </label>
            <Button type="button" variant="secondary" className="rounded-xl ml-auto" disabled={cancelSaving} onClick={() => void saveCancelEnd()}>
              {cancelSaving ? "儲存中…" : "儲存"}
            </Button>
          </div>

          <div className="flex max-w-md flex-col gap-2 sm:flex-row sm:items-end pt-2">
            <div className="min-w-0 flex-1 space-y-1.5">
              <label className="text-xs font-medium text-ink-secondary" htmlFor={`u-bp-${userId}`}>
                billing_provider（空＝清除）
              </label>
              <Input
                id={`u-bp-${userId}`}
                value={billingProvider}
                onChange={(e) => setBillingProvider(e.target.value)}
                className="font-mono text-sm"
              />
            </div>
            <Button
              type="button"
              className="rounded-xl sm:shrink-0"
              disabled={providerSaving}
              onClick={() => void saveBillingProvider()}
            >
              {providerSaving ? "儲存中…" : "儲存來源"}
            </Button>
          </div>
        </div>

        <div className="border-t border-surface-border/80 pt-6 space-y-3">
          <p className="text-sm font-medium text-ink">手動營運覆寫註記</p>
          <p className="text-xs leading-relaxed text-ink-secondary">
            僅寫入稽核（<code className="font-mono text-[11px]">user_manual_override</code>），不強制變更金流資料。用於對帳、例外與人工判斷紀錄。
          </p>
          <textarea
            value={overrideNote}
            onChange={(e) => setOverrideNote(e.target.value)}
            rows={3}
            className="w-full max-w-lg rounded-xl border border-surface-border bg-white px-3 py-2 text-sm text-ink outline-none ring-offset-white focus-visible:ring-2 focus-visible:ring-ink/20"
            placeholder="輸入註記…"
          />
          <Button type="button" variant="secondary" className="rounded-xl" disabled={overrideSaving} onClick={() => void saveManualOverride()}>
            {overrideSaving ? "寫入中…" : "寫入稽核"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
