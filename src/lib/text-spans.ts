import type { TextSpan } from "@/types/analysis";

/** 在原文中找出所有不重疊的匹配區間（簡化：逐字串搜尋）。 */
export function findAllSpans(text: string, needle: string): TextSpan[] {
  if (!needle) return [];
  const spans: TextSpan[] = [];
  let from = 0;
  while (from < text.length) {
    const i = text.indexOf(needle, from);
    if (i === -1) break;
    spans.push({ start: i, end: i + needle.length });
    from = i + Math.max(1, needle.length);
  }
  return spans;
}

export function mergeFindingsSpans(
  text: string,
  matchedText: string,
  riskyPhrase: string
): TextSpan[] {
  const primary = findAllSpans(text, matchedText);
  if (primary.length) return primary;
  return findAllSpans(text, riskyPhrase);
}

export function mergeIntervals(spans: TextSpan[]): TextSpan[] {
  if (!spans.length) return [];
  const sorted = [...spans].sort((a, b) => a.start - b.start);
  const out: TextSpan[] = [];
  let cur = { ...sorted[0] };
  for (let i = 1; i < sorted.length; i++) {
    const s = sorted[i];
    if (s.start <= cur.end) {
      cur.end = Math.max(cur.end, s.end);
    } else {
      out.push(cur);
      cur = { ...s };
    }
  }
  out.push(cur);
  return out;
}
