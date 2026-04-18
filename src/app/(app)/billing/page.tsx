import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { NotifyProButton } from "@/components/billing/NotifyProButton";
import { BillingCancelInterestButton } from "@/components/billing/BillingCancelInterestButton";
import {
  billingProviderLabelZh,
  deriveBillingUiState,
  subscriptionStatusLabelZh,
} from "@/lib/billing/subscription-state";
import type { WorkspaceBillingSnapshot } from "@/lib/billing/types";
import { getPrimaryWorkspaceForUser } from "@/lib/workspace/primary-workspace";
import Link from "next/link";

function getSingleSearchParam(
  searchParams: Record<string, string | string[] | undefined>,
  key: string
): string | undefined {
  const value = searchParams[key];
  if (value === undefined) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

function formatPeriodEndTaipei(iso: string | null | undefined): string | null {
  if (!iso) return null;
  try {
    return new Intl.DateTimeFormat("zh-TW", {
      dateStyle: "medium",
      timeZone: "Asia/Taipei",
    }).format(new Date(iso));
  } catch {
    return null;
  }
}

type BillingPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function BillingPage({ searchParams }: BillingPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const checkout = getSingleSearchParam(resolvedSearchParams, "checkout");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const ws = await getPrimaryWorkspaceForUser(supabase, user!.id);

  const snapshot: WorkspaceBillingSnapshot | null = ws
    ? {
        plan: ws.plan,
        subscription_status: ws.subscription_status,
        billing_provider: ws.billing_provider,
        cancel_at_period_end: ws.cancel_at_period_end,
        current_period_end: ws.current_period_end,
      }
    : null;

  const yymm = new Date().toISOString().slice(0, 7);
  const used = ws && ws.usage_month === yymm ? ws.units_used_month : 0;
  const quota = ws?.monthly_quota_units ?? 0;
  const remaining = ws ? Math.max(0, quota - used) : 0;

  const rawStatus = ws?.subscription_status ?? null;
  const statusLabel = subscriptionStatusLabelZh(rawStatus);
  const uiState = deriveBillingUiState(snapshot);
  const periodEndLabel = formatPeriodEndTaipei(ws?.current_period_end ?? null);
  const planLower = (ws?.plan ?? "free").toLowerCase();
  const showProInterestCard = planLower === "free" && uiState === "free";
  const providerLabel = billingProviderLabelZh(ws?.billing_provider ?? null);

  return (
    <div className="mx-auto max-w-4xl space-y-10">
      <div className="max-w-2xl space-y-3">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-ink-secondary">帳務</p>
        <h1 className="text-2xl font-medium tracking-tight text-ink sm:text-[1.625rem]">方案與計費</h1>
        <p className="text-[15px] leading-relaxed text-ink-secondary">
          方案與訂閱狀態以工作區為準（多帳號共用）。台灣在地金流上線後，將由此同步週期計費與發票資訊。
        </p>
        {ws ? (
          <p className="mt-2 text-sm text-ink-secondary">
            目前工作區：<span className="font-semibold text-ink">{ws.name}</span>
            <Link href="/team" className="ml-2 font-medium text-ink underline-offset-4 hover:underline">
              切換或管理成員與額度
            </Link>
          </p>
        ) : null}
      </div>

      {checkout === "success" ? (
        <Card className="border-emerald-200/80 bg-emerald-50/50">
          <CardHeader>
            <CardTitle className="text-base text-emerald-950">已收到你的操作</CardTitle>
            <CardDescription className="text-emerald-900/80">
              若你剛完成與付款相關的步驟，狀態同步可能需要一點時間。若此頁仍顯示舊資料，請稍後重新整理。
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {checkout === "cancel" ? (
        <Card className="border-surface-border bg-white">
          <CardHeader>
            <CardTitle className="text-base text-ink">已取消</CardTitle>
            <CardDescription>未進行扣款。需要升級時，隨時可再試一次。</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {uiState === "payment_issue" ? (
        <Card className="border-amber-200/80 bg-amber-50/45">
          <CardHeader>
            <CardTitle className="text-base text-amber-950">付款狀態需要處理</CardTitle>
            <CardDescription className="text-amber-900/80">
              此工作區訂閱目前為「{statusLabel}」。請留意帳務通知信，或與我們聯繫更新付款方式，以免影響多帳號共用方案的使用。線上更新入口將在金流上線後開放。
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {uiState === "cancel_scheduled" ? (
        <Card className="border-surface-border bg-canvas">
          <CardHeader>
            <CardTitle className="text-base text-ink">已排程取消</CardTitle>
            <CardDescription className="text-ink-secondary">
              訂閱將在目前計費週期結束後調整。
              {periodEndLabel ? ` 目前週期預計結束日：${periodEndLabel}（台北時間）。` : null}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {!ws ? (
        <Card className="border-amber-100/90 bg-amber-50/35">
          <CardHeader>
            <CardTitle className="text-base">尚未找到工作區</CardTitle>
            <CardDescription>
              請確認資料庫 migration 已套用並重新登入。若問題持續，請聯絡管理員。
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle>共用方案與審查額度</CardTitle>
              <Badge tone="blue">{ws?.plan === "pro" ? "Pro" : "Free"}</Badge>
              {uiState === "active" ? <Badge tone="emerald">訂閱中</Badge> : null}
              {uiState === "cancel_scheduled" ? (
                <Badge tone="amber">週期末取消</Badge>
              ) : null}
            </div>
            <CardDescription>
              訂閱狀態：{statusLabel}
              {providerLabel ? (
                <span className="text-ink-secondary"> · 帳務來源：{providerLabel}</span>
              ) : null}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-ink-secondary">
            <div className="flex justify-between gap-4 border-b border-surface-border/80 pb-2">
              <span>本月共用審查額度</span>
              <span className="font-semibold text-ink">{quota || "—"}</span>
            </div>
            <div className="flex justify-between gap-4 border-b border-surface-border/80 pb-2">
              <span>已使用額度</span>
              <span className="font-semibold text-ink">{ws ? used : "—"}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span>剩餘額度</span>
              <span className="font-semibold text-ink">{ws ? remaining : "—"}</span>
            </div>
            <p className="pt-1 text-xs leading-relaxed">
              審查點數可多人共用（多個帳號可共用額度）；文字與圖片各計 1 點，PDF 依頁數計。調整上限請至「成員」頁面（擁有者／管理員）。
            </p>
          </CardContent>
        </Card>

        {showProInterestCard ? (
          <Card className="relative overflow-hidden border-surface-border bg-white ring-1 ring-black/[0.04]">
            <div className="absolute right-4 top-4">
              <Badge tone="blue">Pro</Badge>
            </div>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-medium">Pro 方案</CardTitle>
              <CardDescription className="text-pretty">
                更高共用審查額度、優先處理與完整協作流程。台灣在地週期計費上線後即可於此完成升級。
              </CardDescription>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-3xl font-medium tracking-tight text-ink">NT$990</span>
                <span className="text-sm text-ink-secondary">/ 月（示意）</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <ul className="space-y-3 text-sm text-ink-secondary">
                <li className="flex gap-2">
                  <span className="mt-0.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-400" />
                  更高月度審查額度（依正式方案為準）
                </li>
                <li className="flex gap-2">
                  <span className="mt-0.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-400" />
                  優先佇列與多人紀錄協作
                </li>
                <li className="flex gap-2">
                  <span className="mt-0.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-400" />
                  帳務與週期管理（金流上線後啟用）
                </li>
              </ul>
              <NotifyProButton disabled={false} />
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>訂閱與週期</CardTitle>
              <CardDescription>
                {uiState === "active"
                  ? "此工作區的 Pro 訂閱目前為有效狀態。週期結束日與線上異動將在金流串接完成後顯示於此。"
                  : uiState === "cancel_scheduled"
                    ? "已排程於週期結束後調整方案，無需重複操作。"
                    : "若有帳務疑問，請依通知信或支援管道與我們聯繫。"}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <BillingCancelInterestButton disabled={false} />
            </CardContent>
          </Card>
        )}
      </div>
      )}
    </div>
  );
}
