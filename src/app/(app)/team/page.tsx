"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { useWorkspace } from "@/components/workspace/WorkspaceContext";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

export default function TeamSettingsPage() {
  const { workspaces, selectedId, loading, refresh } = useWorkspace();
  const ws = workspaces.find((w) => w.id === selectedId) ?? workspaces[0];
  const [name, setName] = useState("");
  const [quota, setQuota] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (ws) {
      setName(ws.name);
      setQuota(String(ws.monthlyQuotaUnits));
    }
  }, [ws]);

  async function save() {
    if (!ws) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/workspaces/${ws.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || undefined,
          monthlyQuotaUnits: quota ? Number(quota) : undefined,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "儲存失敗");
        return;
      }
      toast.success("已更新工作區設定");
      await refresh();
    } finally {
      setSaving(false);
    }
  }

  if (loading || !ws) {
    return (
      <div className="mx-auto max-w-3xl py-10 text-sm text-ink-secondary">
        {loading ? "載入工作區…" : "找不到工作區。請確認資料庫 migration 已套用。"}
      </div>
    );
  }

  const canManage = ws.role === "owner" || ws.role === "admin";
  const isMemberOnly = ws.role === "member";
  const yymm = new Date().toISOString().slice(0, 7);
  const used = ws.usageMonth === yymm ? ws.unitsUsedMonth : 0;
  const remaining = Math.max(0, ws.monthlyQuotaUnits - used);

  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <div className="space-y-3">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-ink-secondary">工作區</p>
        <h1 className="text-2xl font-medium tracking-tight text-ink sm:text-[1.625rem]">多帳號共用與設定</h1>
        <div className="text-[15px] leading-relaxed text-ink-secondary">
          審查額度與方案以工作區為準。請至
          <Link href="/team/members" className="mx-1 font-medium text-ink underline-offset-4 hover:underline">
            成員管理
          </Link>
          。
        </div>
      </div>

      {isMemberOnly ? (
        <Card className="border-surface-border bg-canvas">
          <CardContent className="py-4 text-sm text-ink-secondary">
            你目前為<span className="font-semibold text-ink">成員</span>
            ：可檢視額度與使用紀錄；邀請成員與調整額度需擁有者或管理員。
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle>共用審查額度</CardTitle>
            <Badge tone="blue">{ws.plan === "pro" ? "Pro" : "Free"}</Badge>
            <BadgeRole role={ws.role} />
          </div>
          <CardDescription>多個帳號可共用審查點數。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex justify-between gap-4 border-b border-surface-border/80 pb-2 text-ink-secondary">
            <span>本月共用審查額度</span>
            <span className="font-semibold text-ink">{ws.monthlyQuotaUnits}</span>
          </div>
          <div className="flex justify-between gap-4 border-b border-surface-border/80 pb-2 text-ink-secondary">
            <span>已使用額度</span>
            <span className="font-semibold text-ink">{used}</span>
          </div>
          <div className="flex justify-between gap-4 text-ink-secondary">
            <span>剩餘額度</span>
            <span className="text-2xl font-semibold tabular-nums text-ink">{remaining}</span>
          </div>
        </CardContent>
      </Card>

      {canManage ? (
        <Card>
          <CardHeader>
            <CardTitle>工作區設定</CardTitle>
            <CardDescription>擁有者與管理員可更新名稱與每月審查額度上限。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-ink">工作區名稱</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} className="h-11 rounded-xl" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-ink">本月共用審查額度（點數）</label>
              <Input
                type="number"
                min={100}
                value={quota}
                onChange={(e) => setQuota(e.target.value)}
                className="h-11 rounded-xl"
              />
              <p className="text-xs text-ink-secondary">PDF 依頁數扣點；單檔最多 50 頁。</p>
            </div>
            <Button type="button" className="h-11 rounded-xl" disabled={saving} onClick={() => void save()}>
              {saving ? "儲存中…" : "儲存變更"}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-8 text-sm text-ink-secondary">
            僅擁有者或管理員可編輯工作區名稱與額度上限。
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function BadgeRole({ role }: { role: string }) {
  const label = role === "owner" ? "擁有者" : role === "admin" ? "管理員" : "成員";
  return (
    <span className="rounded-lg border border-surface-border bg-canvas px-3 py-1.5 text-xs font-medium text-ink-secondary">
      {label}
    </span>
  );
}
