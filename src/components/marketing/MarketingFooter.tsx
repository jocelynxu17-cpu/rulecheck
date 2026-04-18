import Link from "next/link";

export function MarketingFooter() {
  return (
    <footer className="border-t border-surface-border bg-canvas">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-5 py-14 sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-10">
        <div>
          <p className="text-sm font-medium text-ink">RuleCheck</p>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-secondary">
            台灣化粧品與食品廣告合規輔助工具。輸出僅供內部自查，不構成法律意見。
          </p>
        </div>
        <div className="flex flex-wrap gap-8 text-sm text-ink-secondary">
          <Link href="/pricing" className="transition hover:text-ink">
            定價
          </Link>
          <Link href="/analyze" className="transition hover:text-ink">
            檢測
          </Link>
          <Link href="/login" className="transition hover:text-ink">
            登入
          </Link>
        </div>
      </div>
    </footer>
  );
}
