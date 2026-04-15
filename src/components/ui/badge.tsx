import type { HTMLAttributes } from "react";
import type { RiskCategory, RiskSeverity } from "@/types/analysis";

type Tone = "neutral" | "blue" | "amber" | "red" | "emerald";

const tones: Record<Tone, string> = {
  neutral: "bg-surface border-surface-border text-ink-secondary",
  blue: "bg-brand/10 border-brand/20 text-brand-strong",
  amber: "bg-amber-50 border-amber-100 text-amber-900",
  red: "bg-red-50 border-red-100 text-red-800",
  emerald: "bg-emerald-50 border-emerald-100 text-emerald-900",
};

export function Badge({
  tone = "neutral",
  className = "",
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={`inline-flex items-center rounded-lg border px-2.5 py-0.5 text-xs font-medium ${tones[tone]} ${className}`}
      {...props}
    />
  );
}

const severityTone: Record<RiskSeverity, Tone> = {
  high: "red",
  medium: "amber",
  low: "emerald",
};

export function SeverityBadge({ severity }: { severity: RiskSeverity }) {
  const label = severity === "high" ? "高" : severity === "medium" ? "中" : "低";
  return <Badge tone={severityTone[severity]}>{label}風險</Badge>;
}

const categoryTone: Record<RiskCategory, Tone> = {
  醫療效能: "red",
  誇大: "amber",
  誤導: "amber",
  其他: "neutral",
};

export function CategoryBadge({ category }: { category: RiskCategory }) {
  return <Badge tone={categoryTone[category]}>{category}</Badge>;
}
