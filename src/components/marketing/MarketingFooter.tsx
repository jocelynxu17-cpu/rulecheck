import Link from "next/link";

export function MarketingFooter() {
  return (
    <footer className="border-t border-surface-border bg-white/60">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-12 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <div>
          <p className="text-sm font-semibold text-ink">RuleCheck</p>
          <p className="mt-1 max-w-md text-sm text-ink-secondary">
            台灣化粧品與食品廣告合規輔助工具。輸出僅供內部自查，不構成法律意見。
          </p>
        </div>
        <div className="flex flex-wrap gap-6 text-sm text-ink-secondary">
          <Link href="/pricing" className="hover:text-brand-strong">
            定價
          </Link>
          <Link href="/analyze" className="hover:text-brand-strong">
            檢測
          </Link>
          <Link href="/login" className="hover:text-brand-strong">
            登入
          </Link>
        </div>
      </div>
    </footer>
  );
}
