import Link from "next/link";

export function GuestConversionCard() {
  return (
    <div className="overflow-hidden rounded-xl border border-surface-border bg-white">
      <div className="border-b border-surface-border px-6 py-6">
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-ink-secondary">Upgrade</p>
        <h3 className="mt-3 text-lg font-medium tracking-tight text-ink">解鎖完整版 RuleCheck</h3>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-secondary">
          你已體驗訪客檢測。接下來以多帳號共用紀錄、配額與訂閱管理，把合規流程變成可複製的作業方式。
        </p>
      </div>
      <div className="grid gap-0 md:grid-cols-2">
        <div className="border-b border-surface-border px-6 py-6 md:border-b-0 md:border-r md:border-surface-border">
          <p className="text-sm font-medium text-ink">Free</p>
          <ul className="mt-4 space-y-3 text-sm text-ink-secondary">
            <li className="flex gap-2">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-zinc-300" />
              每月固定檢測配額（依方案）
            </li>
            <li className="flex gap-2">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-zinc-300" />
              分析紀錄可回溯檢視
            </li>
            <li className="flex gap-2">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-zinc-300" />
              訂閱與帳務入口（台灣金流準備中）
            </li>
          </ul>
        </div>
        <div className="px-6 py-6">
          <p className="text-sm font-medium text-ink">Pro</p>
          <ul className="mt-4 space-y-3 text-sm text-ink-secondary">
            <li className="flex gap-2">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-zinc-400" />
              更高月度配額，適合成長期內容節奏
            </li>
            <li className="flex gap-2">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-zinc-400" />
              重新產生三語氣改寫（登入後可用）
            </li>
            <li className="flex gap-2">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-zinc-400" />
              帳務入口集中管理付款方式
            </li>
          </ul>
        </div>
      </div>
      <div className="flex flex-col gap-4 border-t border-surface-border px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs leading-relaxed text-ink-secondary">不構成法律意見；實際合規仍以主管機關與律師見解為準。</p>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/signup"
            className="inline-flex h-10 items-center justify-center rounded-lg bg-brand-strong px-5 text-sm font-medium text-white transition hover:bg-brand-strong/90"
          >
            免費註冊
          </Link>
          <Link
            href="/pricing"
            className="inline-flex h-10 items-center justify-center rounded-lg border border-surface-border bg-white px-5 text-sm font-medium text-ink transition hover:bg-zinc-50"
          >
            查看定價
          </Link>
        </div>
      </div>
    </div>
  );
}
