"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

type Props = {
  workspaceId: string;
  initialMonthlyQuotaUnits: number;
  initialPlan: string | null;
  initialSubscriptionStatus: string | null;
};

export function AdminWorkspaceSingleOpsCard({
  workspaceId,
  initialMonthlyQuotaUnits,
  initialPlan,
  initialSubscriptionStatus,
}: Props) {
  const router = useRouter();
  const [repairing, setRepairing] = useState(false);
  const [quota, setQuota] = useState(String(initialMonthlyQuotaUnits));
  const [plan, setPlan] = useState(initialPlan ?? "");
  const [subscriptionStatus, setSubscriptionStatus] = useState(initialSubscriptionStatus ?? "");
  const [quotaSaving, setQuotaSaving] = useState(false);
  const [planSaving, setPlanSaving] = useState(false);
  const [statusSaving, setStatusSaving] = useState(false);

  async function runRepairThisWorkspace() {
    setRepairing(true);
    try {
      const res = await fetch(`/api/admin/workspaces/${encodeURIComponent(workspaceId)}/repair`, {
        method: "POST",
        credentials: "same-origin",
      });
      const body = (await res.json()) as {
        ok?: boolean;
        error?: string;
        message?: string;
        ownersLinked?: number;
      };
      if (!res.ok || body.ok === false) {
        toast.error("修復失敗", { description: body.error ?? `HTTP ${res.status}` });
        return;
      }
      toast.success("修復完成", { description: body.message ?? "已處理。" });
      router.refresh();
    } finally {
      setRepairing(false);
    }
  }

  async function saveQuota() {
    const q = Number.parseInt(quota.trim(), 10);
    if (!Number.isFinite(q)) {
      toast.error("請輸入整數額度。");
      return;
    }
    setQuotaSaving(true);
    try {
      const res = await fetch(`/api/admin/workspaces/${encodeURIComponent(workspaceId)}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ monthly_quota_units: q }),
      });
      const body = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || body.ok === false) {
        toast.error("更新失敗", { description: body.error ?? `HTTP ${res.status}` });
        return;
      }
      toast.success("共用審查額度已更新");
      router.refresh();
    } finally {
      setQuotaSaving(false);
    }
  }

  async function savePlan() {
    const p = plan.trim();
    if (!p) {
      toast.error("請輸入方案字串（例如 free、pro）。");
      return;
    }
    setPlanSaving(true);
    try {
      const res = await fetch(`/api/admin/workspaces/${encodeURIComponent(workspaceId)}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: p }),
      });
      const body = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || body.ok === false) {
        toast.error("更新失敗", { description: body.error ?? `HTTP ${res.status}` });
        return;
      }
      toast.success("方案已更新", { description: "請同步確認金流與對帳。" });
      router.refresh();
    } finally {
      setPlanSaving(false);
    }
  }

  async function saveSubscriptionStatus() {
    setStatusSaving(true);
    try {
      const raw = subscriptionStatus.trim();
      const payload =
        raw === "" || raw === "-" ? { subscription_status: null } : { subscription_status: raw };

      const res = await fetch(`/api/admin/workspaces/${encodeURIComponent(workspaceId)}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || body.ok === false) {
        toast.error("更新失敗", { description: body.error ?? `HTTP ${res.status}` });
        return;
      }
      toast.success("訂閱狀態已更新", { description: "請同步確認 Stripe／金流紀錄。" });
      router.refresh();
    } finally {
      setStatusSaving(false);
    }
  }

  return (
    <Card className="border-surface-border">
      <CardHeader>
        <CardTitle className="text-base">營運動作（此工作區）</CardTitle>
        <CardDescription>
          以 service role 寫入；變更後請以本頁摘要與帳務事件交叉驗證。全站修復仍請至{" "}
          <Link href="/internal" className="font-medium text-ink underline-offset-4 hover:underline">
            營運總覽
          </Link>
          。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        <div className="space-y-3">
          <p className="text-sm font-medium text-ink">修復此工作區</p>
          <p className="text-xs leading-relaxed text-ink-secondary">
            若擁有者（<code className="rounded bg-canvas px-1 font-mono text-[11px]">created_by</code>
            ）尚無{" "}
            <code className="rounded bg-canvas px-1 font-mono text-[11px]">owner</code> 成員列，將自動補上。
          </p>
          <Button
            type="button"
            variant="secondary"
            className="rounded-xl"
            disabled={repairing}
            onClick={() => void runRepairThisWorkspace()}
          >
            {repairing ? "執行中…" : "修復此工作區"}
          </Button>
        </div>

        <div className="border-t border-surface-border/80 pt-6 space-y-4">
          <p className="text-sm font-medium text-ink">調整共用審查額度</p>
          <div className="flex max-w-md flex-col gap-2 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1 space-y-1.5">
              <label className="text-xs font-medium text-ink-secondary" htmlFor={`ws-quota-${workspaceId}`}>
                月度點數上限（monthly_quota_units）
              </label>
              <Input
                id={`ws-quota-${workspaceId}`}
                inputMode="numeric"
                value={quota}
                onChange={(e) => setQuota(e.target.value)}
                className="font-mono text-sm"
              />
            </div>
            <Button type="button" className="rounded-xl sm:shrink-0" disabled={quotaSaving} onClick={() => void saveQuota()}>
              {quotaSaving ? "更新中…" : "套用額度"}
            </Button>
          </div>
        </div>

        <div className="border-t border-surface-border/80 pt-6 space-y-4">
          <p className="text-sm font-medium text-ink">更新方案</p>
          <div className="flex max-w-md flex-col gap-2 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1 space-y-1.5">
              <label className="text-xs font-medium text-ink-secondary" htmlFor={`ws-plan-${workspaceId}`}>
                plan
              </label>
              <Input
                id={`ws-plan-${workspaceId}`}
                value={plan}
                onChange={(e) => setPlan(e.target.value)}
                placeholder="free / pro"
                className="font-mono text-sm"
              />
            </div>
            <Button
              type="button"
              variant="secondary"
              className="rounded-xl sm:shrink-0"
              disabled={planSaving}
              onClick={() => void savePlan()}
            >
              {planSaving ? "寫入中…" : "套用方案"}
            </Button>
          </div>
        </div>

        <div className="border-t border-surface-border/80 pt-6 space-y-4">
          <p className="text-sm font-medium text-ink">更新訂閱狀態</p>
          <div className="flex max-w-md flex-col gap-2 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1 space-y-1.5">
              <label className="text-xs font-medium text-ink-secondary" htmlFor={`ws-sub-${workspaceId}`}>
                subscription_status
              </label>
              <Input
                id={`ws-sub-${workspaceId}`}
                value={subscriptionStatus}
                onChange={(e) => setSubscriptionStatus(e.target.value)}
                placeholder="active、canceled… 留空或填「-」清除為 null"
                className="font-mono text-sm"
              />
            </div>
            <Button
              type="button"
              variant="secondary"
              className="rounded-xl sm:shrink-0"
              disabled={statusSaving}
              onClick={() => void saveSubscriptionStatus()}
            >
              {statusSaving ? "寫入中…" : "套用訂閱狀態"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
