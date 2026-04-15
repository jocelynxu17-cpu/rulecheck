import Link from "next/link";

export function GuestConversionCard() {
  return (
    <div className="overflow-hidden rounded-2xl border border-brand/25 bg-gradient-to-br from-white via-surface to-brand/10 shadow-soft">
      <div className="border-b border-surface-border bg-white/70 px-6 py-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-strong">Upgrade</p>
        <h3 className="mt-2 text-xl font-semibold tracking-tight text-ink">解鎖完整版 RuleCheck</h3>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-secondary">
          你已體驗訪客檢測。接下來讓團隊用紀錄、配額與訂閱管理，把合規流程變成可複製的作業方式。
        </p>
      </div>
      <div className="grid gap-0 md:grid-cols-2">
        <div className="border-b border-surface-border px-6 py-6 md:border-b-0 md:border-r">
          <p className="text-sm font-semibold text-ink">Free</p>
          <ul className="mt-4 space-y-3 text-sm text-ink-secondary">
            <li className="flex gap-2">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-ink-secondary/50" />
              每月固定檢測配額（依方案）
            </li>
            <li className="flex gap-2">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-ink-secondary/50" />
              分析紀錄可回溯檢視
            </li>
            <li className="flex gap-2">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-ink-secondary/50" />
              Stripe 訂閱與客戶入口
            </li>
          </ul>
        </div>
        <div className="px-6 py-6">
          <p className="text-sm font-semibold text-ink">Pro</p>
          <ul className="mt-4 space-y-3 text-sm text-ink-secondary">
            <li className="flex gap-2">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
              更高月度配額，適合成長期內容節奏
            </li>
            <li className="flex gap-2">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
              重新產生三語氣改寫（登入後可用）
            </li>
            <li className="flex gap-2">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
              帳務入口集中管理付款方式
            </li>
          </ul>
        </div>
      </div>
      <div className="flex flex-col gap-3 border-t border-surface-border bg-white/70 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-ink-secondary">不構成法律意見；實際合規仍以主管機關與律師見解為準。</p>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/signup"
            className="inline-flex h-11 items-center justify-center rounded-xl bg-gradient-to-br from-[#B8D9FF] via-brand to-brand-strong px-5 text-sm font-semibold text-white shadow-soft transition hover:brightness-[1.03]"
          >
            免費註冊
          </Link>
          <Link
            href="/pricing"
            className="inline-flex h-11 items-center justify-center rounded-xl border border-surface-border bg-white px-5 text-sm font-semibold text-ink shadow-sm transition hover:border-brand/40"
          >
            查看定價
          </Link>
        </div>
      </div>
    </div>
  );
}
