import type { AnalysisRewrites } from "@/types/analysis";

export const REWRITE_LABELS: Record<keyof AnalysisRewrites, string> = {
  conservative: "保守安全版",
  marketing: "行銷自然版",
  ecommerce: "電商簡潔版",
};

export const REWRITE_KEYS = Object.keys(REWRITE_LABELS) as (keyof AnalysisRewrites)[];
