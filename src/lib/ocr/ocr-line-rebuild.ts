import type { OcrBlockSnippet, OcrLineSnippet } from "@/lib/ocr/tesseract-page-result";

/** 將整頁 OCR 全文拆成行／單一區塊結構（供預覽列表；不含 Tesseract 幾何）。 */
export function rebuildOcrLinePreviewsFromFullText(
  fullText: string,
  pageConfidence: number,
  maxLines: number
): { lines: OcrLineSnippet[]; blocks: OcrBlockSnippet[] } {
  const normalized = fullText.replace(/\r\n/g, "\n").trimEnd();
  const parts = normalized.length ? normalized.split("\n") : [];
  const lineTexts = parts.length > 0 ? parts : normalized.trim() ? [normalized.trim()] : [];
  const capped = lineTexts.slice(0, maxLines);
  const lines: OcrLineSnippet[] = capped
    .map((t) => ({ text: t.trim(), confidence: pageConfidence }))
    .filter((l) => l.text.length > 0);
  if (lines.length === 0 && normalized.trim()) {
    lines.push({ text: normalized.trim(), confidence: pageConfidence });
  }
  const blockText = lines.map((l) => l.text).join("\n");
  const blocks: OcrBlockSnippet[] =
    lines.length > 0
      ? [
          {
            text: blockText,
            confidence: pageConfidence,
            lines,
          },
        ]
      : [];
  return { lines, blocks };
}
