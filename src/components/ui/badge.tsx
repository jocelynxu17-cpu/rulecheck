import type { HTMLAttributes } from "react";
import type { RiskCategory, RiskSeverity } from "@/types/analysis";

type Tone = "neutral" | "blue" | "amber" | "red" | "emerald";

const tones: Record<Tone, string> = {
  neutral: "border-zinc-200/90 bg-zinc-50 text-zinc-700",
  blue: "border-zinc-200 bg-zinc-100/80 text-zinc-800",
  amber: "border-amber-200/90 bg-amber-50 text-amber-900",
  red: "border-red-200/90 bg-red-50 text-red-900",
  emerald: "border-emerald-200/90 bg-emerald-50 text-emerald-900",
};

export function Badge({
  tone = "neutral",
  className = "",
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium tracking-wide ${tones[tone]} ${className}`}
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
