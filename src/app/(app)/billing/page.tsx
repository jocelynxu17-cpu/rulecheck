import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckoutButton } from "@/components/billing/CheckoutButton";
import { PortalButton } from "@/components/billing/PortalButton";

type SearchParams = { checkout?: string | string[] };

export default async function BillingPage({
  searchParams,
}: {
  searchParams: SearchParams | Promise<SearchParams>;
}) {
  const sp = await Promise.resolve(searchParams);
  const checkoutRaw = sp.checkout;
  const checkout = Array.isArray(checkoutRaw) ? checkoutRaw[0] : checkoutRaw;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("users")
    .select(
      "plan, monthly_analysis_quota, analyses_used_month, usage_month, stripe_customer_id, subscription_status"
    )
    .eq("id", user!.id)
    .maybeSingle();

  const yymm = new Date().toISOString().slice(0, 7);
  const used =
    profile?.usage_month === yymm ? profile?.analyses_used_month ?? 0 : 0;
  const quota = profile?.monthly_analysis_quota ?? 30;
  const remaining = Math.max(0, quota - used);

  const hasStripeCustomer = Boolean(profile?.stripe_customer_id);
  const stripeReady = Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_PRO);

  const status = profile?.subscription_status ?? "—";
  const pastDue = status === "past_due" || status === "unpaid";

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-ink">帳務與方案</h1>
        <p className="mt-2 text-sm text-ink-secondary">
          使用 Stripe 完成訂閱與付款方式管理。完成付款後，方案狀態會由 Webhook 自動同步。
        </p>
      </div>

      {checkout === "success" ? (
        <Card className="border-emerald-200 bg-emerald-50/60">
          <CardHeader>
            <CardTitle className="text-base text-emerald-950">結帳已完成</CardTitle>
            <CardDescription className="text-emerald-900/80">
              Stripe 正在同步訂閱狀態與配額，通常數十秒內完成。若此頁仍顯示舊方案，請重新整理。
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {checkout === "cancel" ? (
        <Card className="border-surface-border bg-white">
          <CardHeader>
            <CardTitle className="text-base text-ink">已取消結帳</CardTitle>
            <CardDescription>未進行扣款。需要升級時，隨時可再試一次。</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {!stripeReady ? (
        <Card className="border-amber-200 bg-amber-50/60">
          <CardHeader>
            <CardTitle className="text-base text-amber-950">Stripe 尚未啟用</CardTitle>
            <CardDescription className="text-amber-900/80">
              請在部署環境設定 STRIPE_SECRET_KEY 與 STRIPE_PRICE_PRO，並完成 Webhook 端點設定。
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {pastDue ? (
        <Card className="border-amber-200 bg-amber-50/60">
          <CardHeader>
            <CardTitle className="text-base text-amber-950">付款狀態需要處理</CardTitle>
            <CardDescription className="text-amber-900/80">
              你的訂閱目前為「{status === "past_due" ? "逾期" : "未付款"}」狀態。請前往客戶入口更新付款方式，以免影響使用。
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle>目前方案</CardTitle>
              <Badge tone="blue">{profile?.plan === "pro" ? "Pro" : "Free"}</Badge>
            </div>
            <CardDescription>訂閱狀態：{status}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-ink-secondary">
            <p>
              本月已用：<span className="font-medium text-ink">{used}</span> / {quota}
            </p>
            <p>
              剩餘額度：<span className="font-medium text-ink">{remaining}</span>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>付款與訂閱</CardTitle>
            <CardDescription>升級至 Pro，或管理付款方式與訂閱週期。</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row">
            <CheckoutButton disabled={profile?.plan === "pro" || !stripeReady} />
            <PortalButton disabled={!hasStripeCustomer || !stripeReady} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
