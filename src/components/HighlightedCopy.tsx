import type { ReactNode } from "react";
import type { TextSpan } from "@/types/analysis";
import { mergeIntervals } from "@/lib/text-spans";

export function HighlightedCopy({ text, spans }: { text: string; spans: TextSpan[] }) {
  const merged = mergeIntervals(spans);
  if (!merged.length) {
    return <p className="whitespace-pre-wrap leading-relaxed text-ink">{text}</p>;
  }

  const nodes: ReactNode[] = [];
  let cursor = 0;
  merged.forEach((s, idx) => {
    if (s.start > cursor) {
      nodes.push(
        <span key={`t-${idx}-${cursor}`} className="text-ink">
          {text.slice(cursor, s.start)}
        </span>
      );
    }
    nodes.push(
      <mark
        key={`h-${idx}`}
        className="rounded bg-amber-100/90 px-0.5 font-medium text-ink ring-1 ring-amber-200/70"
      >
        {text.slice(s.start, s.end)}
      </mark>
    );
    cursor = s.end;
  });
  if (cursor < text.length) {
    nodes.push(
      <span key="end" className="text-ink">
        {text.slice(cursor)}
      </span>
    );
  }

  return <p className="whitespace-pre-wrap leading-relaxed">{nodes}</p>;
}
