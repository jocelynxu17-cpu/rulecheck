import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getPrimaryWorkspaceForUser } from "@/lib/workspace/primary-workspace";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const ws = await getPrimaryWorkspaceForUser(supabase, user!.id);

  const yymm = new Date().toISOString().slice(0, 7);
  const used = ws && ws.usage_month === yymm ? ws.units_used_month : 0;
  const quota = ws?.monthly_quota_units ?? 0;
  const remaining = ws ? Math.max(0, quota - used) : 0;

  return (
    <div className="mx-auto max-w-4xl space-y-12">
      <div className="max-w-2xl space-y-3">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-ink-secondary">總覽</p>
        <h1 className="text-2xl font-medium tracking-tight text-ink sm:text-[1.625rem]">工作區摘要</h1>
        <p className="text-[15px] leading-relaxed text-ink-secondary">
          以工作區為單位共用審查額度與方案，支援文字、圖片 OCR 與 PDF 分頁檢測。
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle>共用審查額度</CardTitle>
              <Badge tone="blue">{ws?.plan === "pro" ? "Pro" : "Free"}</Badge>
              {ws ? <span className="text-xs text-ink-secondary">{ws.name}</span> : null}
            </div>
            <CardDescription>多個帳號可共用額度；非每人獨立計價。</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-end justify-between gap-8">
            <div className="min-w-[200px] flex-1 space-y-4 text-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-4 border-b border-surface-border pb-3">
                <span className="text-ink-secondary">本月共用審查額度</span>
                <span className="text-2xl font-medium tabular-nums tracking-tight text-ink">{ws ? quota : "—"}</span>
              </div>
              <div className="flex flex-wrap items-baseline justify-between gap-4 border-b border-surface-border pb-3">
                <span className="text-ink-secondary">已使用額度</span>
                <span className="font-medium tabular-nums text-ink">{ws ? used : "—"}</span>
              </div>
              <div className="flex flex-wrap items-baseline justify-between gap-4">
                <span className="text-ink-secondary">剩餘額度</span>
                <span className="text-3xl font-medium tabular-nums tracking-tight text-ink">{ws ? remaining : "—"}</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/analyze"
                className="inline-flex h-10 items-center justify-center rounded-lg bg-brand-strong px-4 text-sm font-medium text-white transition hover:bg-brand-strong/90"
              >
                開始檢測
              </Link>
              <Link
                href="/team"
                className="inline-flex h-10 items-center justify-center rounded-lg border border-surface-border bg-white px-4 text-sm font-medium text-ink transition hover:bg-zinc-50"
              >
                成員管理
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">快速連結</CardTitle>
            <CardDescription>常用頁面一次到位。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <Link
              className="block rounded-lg px-3 py-2 font-medium text-ink transition hover:bg-canvas"
              href="/team/members"
            >
              成員與用量
            </Link>
            <Link className="block rounded-lg px-3 py-2 font-medium text-ink transition hover:bg-canvas" href="/billing">
              帳務與方案
            </Link>
            <Link className="block rounded-lg px-3 py-2 font-medium text-ink transition hover:bg-canvas" href="/settings">
              帳號設定
            </Link>
            <Link className="block rounded-lg px-3 py-2 font-medium text-ink transition hover:bg-canvas" href="/pricing">
              定價方案
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
