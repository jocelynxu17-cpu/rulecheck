"use client";

import { useState } from "react";
import type { AnalysisFinding, AnalysisRewrites } from "@/types/analysis";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CategoryBadge, SeverityBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { REWRITE_KEYS, REWRITE_LABELS } from "@/lib/rewrite-labels";
import { toast } from "sonner";

export function FindingPanel({
  finding,
  fullText,
  allowRegenerate,
}: {
  finding: AnalysisFinding;
  fullText: string;
  allowRegenerate: boolean;
}) {
  const [rewrites, setRewrites] = useState<AnalysisRewrites>(finding.rewrites);
  const [busy, setBusy] = useState(false);

  async function regenerate() {
    if (!allowRegenerate) return;
    setBusy(true);
    try {
      const res = await fetch("/api/analyze/rewrites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          fullText,
          finding: {
            riskyPhrase: finding.riskyPhrase,
            matchedText: finding.matchedText,
            category: finding.category,
            lawName: finding.lawName,
            article: finding.article,
            reason: finding.reason,
            riskType: finding.riskType,
            severity: finding.severity,
            legalReference: finding.legalReference,
            suggestion: finding.suggestion,
            rewrites,
          },
        }),
      });
      const data = (await res.json()) as { rewrites?: AnalysisRewrites; error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "重新產生失敗");
        return;
      }
      if (data.rewrites) {
        setRewrites(data.rewrites);
        toast.success("已更新三語氣改寫");
      }
    } catch {
      toast.error("網路錯誤，請稍後再試");
    } finally {
      setBusy(false);
    }
  }

  async function copyLabel(key: keyof AnalysisRewrites) {
    const t = rewrites[key];
    try {
      await navigator.clipboard.writeText(t);
      toast.success(`已複製：${REWRITE_LABELS[key]}`);
    } catch {
      toast.error("無法複製，請手動選取文字");
    }
  }

  return (
    <Card className="overflow-hidden border-surface-border/90">
      <CardHeader className="space-y-4 border-b border-surface-border/80 bg-white/70 pb-6">
        <div className="flex flex-wrap items-center gap-2">
          <CategoryBadge category={finding.category} />
          <SeverityBadge severity={finding.severity} />
        </div>
        <div className="space-y-2">
          <CardTitle className="text-lg leading-snug text-ink">{finding.riskType}</CardTitle>
          <CardDescription className="text-xs text-ink-secondary">
            命中片段：<span className="font-medium text-ink">{finding.matchedText || finding.riskyPhrase}</span>
          </CardDescription>
        </div>

        <div className="grid gap-4 rounded-2xl border border-surface-border bg-surface p-5 sm:grid-cols-[1fr_auto] sm:items-start">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-secondary">法源與條號</p>
            <p className="text-base font-semibold tracking-tight text-ink">{finding.lawName}</p>
            <p className="inline-flex w-fit rounded-full border border-brand/20 bg-brand/10 px-3 py-1 text-xs font-semibold text-brand-strong">
              {finding.article}
            </p>
          </div>
          <div className="sm:text-right">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-secondary">風險分類</p>
            <p className="mt-2 text-sm font-medium text-ink">{finding.category}</p>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-secondary">重點原因</p>
          <p className="text-sm leading-relaxed text-ink">{finding.reason}</p>
        </div>
      </CardHeader>

      <CardContent className="space-y-8 pt-8">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-secondary">法規脈絡補充</p>
          <p className="text-sm leading-relaxed text-ink-secondary">{finding.legalReference}</p>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-secondary">合規建議</p>
          <p className="text-sm leading-relaxed text-ink">{finding.suggestion}</p>
        </div>

        <div className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-ink">三語氣改寫</p>
              <p className="mt-1 text-xs text-ink-secondary">固定呈現三張卡片，方便法務與行銷對稿。</p>
            </div>
            {allowRegenerate ? (
              <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={() => void regenerate()}>
                {busy ? "產生中…" : "重新產生改寫"}
              </Button>
            ) : (
              <p className="text-xs text-ink-secondary">登入後可重新產生改寫</p>
            )}
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {REWRITE_KEYS.map((key) => (
              <div
                key={key}
                className="flex h-full flex-col rounded-2xl border border-surface-border bg-white p-4 shadow-sm transition hover:border-brand/35"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-semibold text-ink">{REWRITE_LABELS[key]}</p>
                  <Button type="button" variant="ghost" size="sm" onClick={() => void copyLabel(key)}>
                    複製
                  </Button>
                </div>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-ink-secondary">{rewrites[key]}</p>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
