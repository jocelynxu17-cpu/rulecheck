import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("users")
    .select("plan, monthly_analysis_quota, analyses_used_month, usage_month")
    .eq("id", user!.id)
    .maybeSingle();

  const yymm = new Date().toISOString().slice(0, 7);
  const used =
    profile?.usage_month === yymm ? profile?.analyses_used_month ?? 0 : 0;
  const quota = profile?.monthly_analysis_quota ?? 30;
  const remaining = Math.max(0, quota - used);

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-ink">總覽</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-secondary">
          歡迎回來，這裡是你與團隊進行台灣化粧品／食品廣告合規自查的起點。
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle>本月配額</CardTitle>
              <Badge tone="blue">{profile?.plan === "pro" ? "Pro" : "Free"}</Badge>
            </div>
            <CardDescription>每次成功檢測會消耗 1 點額度（失敗重試可能仍計入，視後端設定）。</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="text-4xl font-semibold tracking-tight text-ink">{remaining}</p>
              <p className="text-sm text-ink-secondary">剩餘 / {quota}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/analyze"
                className="inline-flex h-11 items-center justify-center rounded-xl bg-gradient-to-br from-[#B8D9FF] via-brand to-brand-strong px-4 text-sm font-semibold text-white shadow-soft transition hover:brightness-[1.03]"
              >
                開始檢測
              </Link>
              <Link
                href="/history"
                className="inline-flex h-11 items-center justify-center rounded-xl border border-surface-border bg-white px-4 text-sm font-semibold text-ink shadow-sm transition hover:border-brand/40"
              >
                查看紀錄
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">快速連結</CardTitle>
            <CardDescription>常用頁面一次到位。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Link className="block rounded-xl px-3 py-2 text-brand-strong hover:bg-brand/5" href="/billing">
              帳務與升級
            </Link>
            <Link className="block rounded-xl px-3 py-2 text-brand-strong hover:bg-brand/5" href="/settings">
              帳號設定
            </Link>
            <Link className="block rounded-xl px-3 py-2 text-brand-strong hover:bg-brand/5" href="/pricing">
              定價方案
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
