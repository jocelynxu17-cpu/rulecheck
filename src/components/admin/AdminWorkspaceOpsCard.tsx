"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export function AdminWorkspaceOpsCard() {
  const router = useRouter();
  const [repairing, setRepairing] = useState(false);
  const [workspaceId, setWorkspaceId] = useState("");
  const [quota, setQuota] = useState("");
  const [plan, setPlan] = useState("");
  const [status, setStatus] = useState("");
  const [planSaving, setPlanSaving] = useState(false);
  const [quotaSaving, setQuotaSaving] = useState(false);

  async function runRepair() {
    setRepairing(true);
    try {
      const res = await fetch("/api/admin/workspaces/repair", { method: "POST", credentials: "same-origin" });
      const body = (await res.json()) as {
        ok?: boolean;
        error?: string;
        message?: string;
        usersProvisioned?: number;
        ownersLinked?: number;
      };
      if (!res.ok || body.ok === false) {
        toast.error("修復失敗", { description: body.error ?? `HTTP ${res.status}` });
        return;
      }
      toast.success("修復完成", { description: body.message ?? "已同步資料。" });
      router.refresh();
    } finally {
      setRepairing(false);
    }
  }

  async function saveQuota() {
    const id = workspaceId.trim();
    const q = Number.parseInt(quota.trim(), 10);
    if (!id || !Number.isFinite(q)) {
      toast.error("請填寫工作區 UUID 與整數額度。");
      return;
    }
    setQuotaSaving(true);
    try {
      const res = await fetch(`/api/admin/workspaces/${encodeURIComponent(id)}`, {
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
      toast.success("共用審查額度已更新", { description: `工作區 ${id.slice(0, 8)}…` });
      router.refresh();
    } finally {
      setQuotaSaving(false);
    }
  }

  async function savePlanPlaceholder() {
    const id = workspaceId.trim();
    if (!id) {
      toast.error("請填寫工作區 UUID。");
      return;
    }
    setPlanSaving(true);
    try {
      const payload: Record<string, string | null> = {};
      if (plan.trim()) payload.plan = plan.trim();
      if (status.trim()) {
        payload.subscription_status = status.trim() === "-" ? null : status.trim();
      }
      if (Object.keys(payload).length === 0) {
        toast.message("未變更", { description: "請填寫方案，或訂閱狀態（填「-」可清除為 null）。" });
        return;
      }
      const res = await fetch(`/api/admin/workspaces/${encodeURIComponent(id)}`, {
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
      toast.success("方案／狀態已寫入", { description: "請同步確認金流與對帳流程。" });
      router.refresh();
    } finally {
      setPlanSaving(false);
    }
  }

  return (
    <Card className="border-surface-border">
      <CardHeader>
        <CardTitle className="text-base">營運動作</CardTitle>
        <CardDescription>以 service role 執行；請僅於確認需求後操作。</CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        <div className="space-y-3">
          <p className="text-sm font-medium text-ink">全站工作區修復</p>
          <p className="text-xs leading-relaxed text-ink-secondary">
            對齊 migration：為「完全無成員列」的使用者建立預設工作區，並為缺少擁有者列的工作區補上{" "}
            <code className="rounded bg-canvas px-1 font-mono text-[11px]">owner</code>。
          </p>
          <Button type="button" variant="secondary" className="rounded-xl" disabled={repairing} onClick={() => void runRepair()}>
            {repairing ? "執行中…" : "執行全站修復"}
          </Button>
        </div>

        <div className="border-t border-surface-border/80 pt-6 space-y-4">
          <p className="text-sm font-medium text-ink">手動調整（同一工作區）</p>
          <div className="grid gap-3 sm:grid-cols-1 md:grid-cols-2">
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-medium text-ink-secondary" htmlFor="admin-ws-id">
                工作區 UUID
              </label>
              <Input
                id="admin-ws-id"
                value={workspaceId}
                onChange={(e) => setWorkspaceId(e.target.value)}
                placeholder="00000000-0000-0000-0000-000000000000"
                className="font-mono text-sm"
                autoComplete="off"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-ink-secondary" htmlFor="admin-quota">
                共用審查額度（點數／月）
              </label>
              <Input
                id="admin-quota"
                inputMode="numeric"
                value={quota}
                onChange={(e) => setQuota(e.target.value)}
                placeholder="例如 5000"
              />
              <Button
                type="button"
                className="mt-2 w-full rounded-xl sm:w-auto"
                disabled={quotaSaving}
                onClick={() => void saveQuota()}
              >
                {quotaSaving ? "更新中…" : "套用額度"}
              </Button>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-ink-secondary" htmlFor="admin-plan">
                方案（選填，預留與金流對齊）
              </label>
              <Input
                id="admin-plan"
                value={plan}
                onChange={(e) => setPlan(e.target.value)}
                placeholder="free / pro"
              />
              <label className="text-xs font-medium text-ink-secondary mt-2 block" htmlFor="admin-sub-status">
                訂閱狀態（選填）
              </label>
              <Input
                id="admin-sub-status"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                placeholder="active、canceled… 填「-」清除為 null"
              />
              <Button
                type="button"
                variant="secondary"
                className="mt-2 w-full rounded-xl sm:w-auto"
                disabled={planSaving}
                onClick={() => void savePlanPlaceholder()}
              >
                {planSaving ? "寫入中…" : "套用方案／狀態"}
              </Button>
              <p className="text-[11px] leading-relaxed text-ink-secondary">
                與 Stripe／週期同步並存時請謹慎；此處為管理員手動覆寫欄位。
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
