import type { Line, Page } from "tesseract.js";

/** Tesseract 常回傳 0–100；統一為 0–1 供 API／UI 一致使用。 */
export function normalizeOcrConfidence(raw: number): number {
  if (!Number.isFinite(raw)) return 0;
  if (raw >= 0 && raw <= 1) return raw;
  if (raw > 1 && raw <= 100) return Math.min(1, raw / 100);
  return Math.min(1, Math.max(0, raw / 100));
}

export type OcrLineSnippet = {
  text: string;
  /** 0–1 */
  confidence: number;
};

export type OcrBlockSnippet = {
  text: string;
  /** 0–1，區塊平均 */
  confidence: number;
  lines: OcrLineSnippet[];
};

export type OcrDetailedResult = {
  text: string;
  /** 整頁代表信心 0–1（有文字之行的行級信心平均；無行則 page.confidence） */
  confidence: number;
  confidencePercent: number;
  blocks: OcrBlockSnippet[];
  lines: OcrLineSnippet[];
};

function lineToSnippet(line: Line): OcrLineSnippet {
  const t = String(line.text ?? "")
    .replace(/\s+/g, " ")
    .trim();
  return {
    text: t,
    confidence: normalizeOcrConfidence(typeof line.confidence === "number" ? line.confidence : 0),
  };
}

function aggregatePageConfidence(page: Page, flatLines: OcrLineSnippet[]): number {
  const scored = flatLines.filter((l) => l.text.length > 0);
  if (scored.length > 0) {
    const sum = scored.reduce((a, l) => a + l.confidence, 0);
    return normalizeOcrConfidence(sum / scored.length);
  }
  return normalizeOcrConfidence(typeof page.confidence === "number" ? page.confidence : 0);
}

/** 將 Tesseract `Page`（含 blocks）轉成統一結構；伺服器與瀏覽器共用。 */
export function pageToDetailed(page: Page, maxLines: number): OcrDetailedResult {
  const blocks: OcrBlockSnippet[] = [];
  const lines: OcrLineSnippet[] = [];

  const rawBlocks = page.blocks ?? [];
  for (const block of rawBlocks) {
    const blockLines: OcrLineSnippet[] = [];
    const paras = block.paragraphs ?? [];
    for (const para of paras) {
      for (const line of para.lines ?? []) {
        const sn = lineToSnippet(line);
        if (!sn.text) continue;
        blockLines.push(sn);
        lines.push(sn);
        if (lines.length >= maxLines) break;
      }
      if (lines.length >= maxLines) break;
    }
    const blockText = String(block.text ?? "")
      .replace(/\s+/g, " ")
      .trim();
    if (!blockText && blockLines.length === 0) continue;
    const blockConf =
      blockLines.length > 0
        ? blockLines.reduce((a, l) => a + l.confidence, 0) / blockLines.length
        : normalizeOcrConfidence(typeof block.confidence === "number" ? block.confidence : 0);
    blocks.push({
      text: blockText || blockLines.map((l) => l.text).join(" "),
      confidence: blockConf,
      lines: blockLines,
    });
    if (lines.length >= maxLines) break;
  }

  const text = String(page.text ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80_000);

  const confidence = aggregatePageConfidence(page, lines);
  const confidencePercent = Math.round(confidence * 100);

  return { text, confidence, confidencePercent, blocks, lines };
}
