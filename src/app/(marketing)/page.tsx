import Link from "next/link";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function LandingPage() {
  return (
    <div className="px-4 pb-24 pt-16 sm:px-6 lg:px-8 lg:pt-24">
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-strong/90">
          AI × Taiwan compliance
        </p>
        <h1 className="mt-4 text-balance text-4xl font-semibold tracking-tight text-ink sm:text-5xl lg:text-[3.35rem] lg:leading-[1.08]">
          化粧品與食品廣告文案
          <span className="text-brand">，</span>
          一次完成合規盤點
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-ink-secondary">
          RuleCheck 以美系 SaaS 體驗打造：清楚的分類標籤、嚴重度提示、法規脈絡與 AI 改寫建議卡片，協助行銷與法務在同一個畫面完成自查。
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/signup"
            className="inline-flex h-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#B8D9FF] via-brand to-brand-strong px-7 text-sm font-semibold text-white shadow-soft transition hover:brightness-[1.03]"
          >
            免費建立帳號
          </Link>
          <Link
            href="/analyze"
            className="inline-flex h-12 items-center justify-center rounded-xl border border-surface-border bg-white px-7 text-sm font-semibold text-ink shadow-card transition hover:border-brand/40"
          >
            訪客試用檢測
          </Link>
        </div>
        <p className="mt-4 text-xs text-ink-secondary">訪客可免費檢測 1 次 · 本工具不構成法律意見</p>
      </div>

      <div className="mx-auto mt-20 grid max-w-5xl gap-6 lg:grid-cols-3">
        {[
          {
            title: "風險片語標示",
            body: "在原文上高亮顯示高風險詞句，並附上類別與嚴重度徽章。",
          },
          {
            title: "法遵脈絡＋改寫",
            body: "整理可能涉及的法規方向（示意），並提供多張改寫建議卡。",
          },
          {
            title: "紀錄與配額",
            body: "登入後自動儲存分析紀錄，並依方案顯示本月剩餘額度。",
          },
        ].map((c) => (
          <Card key={c.title} className="border-surface-border/90 bg-white/90">
            <CardHeader>
              <CardTitle className="text-base">{c.title}</CardTitle>
              <CardDescription>{c.body}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );
}
