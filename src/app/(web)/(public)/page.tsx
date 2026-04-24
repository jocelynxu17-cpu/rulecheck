import Link from "next/link";

/** 使用者端首頁：精簡、導向檢測工作區。 */
export default function WebLandingPage() {
  return (
    <div className="mx-auto max-w-2xl px-5 pb-24 pt-16 text-center sm:pt-24">
      <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-ink-secondary">RuleCheck</p>
      <h1 className="mt-6 text-balance text-3xl font-medium tracking-tight text-ink sm:text-4xl">
        廣告文案合規盤點，像對話一樣簡單
      </h1>
      <p className="mx-auto mt-5 max-w-lg text-pretty text-[15px] leading-relaxed text-ink-secondary">
        上傳文字、圖片或 PDF，取得風險提示、分類與改寫方向。登入後可與團隊共用審查額度並保留紀錄。
      </p>
      <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/login"
          className="inline-flex h-11 items-center justify-center rounded-xl border border-surface-border bg-white px-8 text-sm font-medium text-ink transition hover:bg-zinc-50"
        >
          登入
        </Link>
        <Link
          href="/signup"
          className="inline-flex h-11 items-center justify-center rounded-xl bg-ink px-8 text-sm font-medium text-white transition hover:bg-ink/90"
        >
          建立帳號
        </Link>
      </div>
      <p className="mt-8 text-xs text-ink-secondary">本工具不構成法律意見</p>
    </div>
  );
}
