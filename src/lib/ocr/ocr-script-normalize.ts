import type { OcrDetailedResult, OcrDisplayNormalizationMeta } from "@/lib/ocr/tesseract-page-result";
import type { OcrHanScriptMeta } from "@/lib/ocr/ocr-han-script";
import { detectHanScriptSummary, getHanCharScriptMaps } from "@/lib/ocr/ocr-han-script";

/** 顯示層要套用的字形方向（由 {@link resolveOcrDisplayScriptMode} 決定） */
export type OcrDisplayScriptMode = "to_trad" | "to_simp" | "leave";

/**
 * 依對照字統計決定顯示層模式：
 * - 明確繁／簡主導 → 朝該字形正規化顯示
 * - 表列「混合」但一方明顯多於另一方（≥2 倍）→ 朝主導方正規化（減輕混碼）
 * - 其餘混合或無對照字 → 不強制整篇轉換（`leave`）
 */
export function resolveOcrDisplayScriptMode(meta: OcrHanScriptMeta): OcrDisplayScriptMode {
  if (meta.code === "trad") return "to_trad";
  if (meta.code === "simp") return "to_simp";

  const t = meta.tradMarkerCount;
  const s = meta.simpMarkerCount;
  if (t >= 1 && s >= 1) {
    if (t >= s * 2) return "to_trad";
    if (s >= t * 2) return "to_simp";
    return "leave";
  }
  if (t >= 1 && s === 0) return "to_trad";
  if (s >= 1 && t === 0) return "to_simp";
  return "leave";
}

function mapByCharTable(text: string, table: ReadonlyMap<string, string>): string {
  if (!text || table.size === 0) return text;
  const out: string[] = [];
  for (const ch of text) {
    out.push(table.get(ch) ?? ch);
  }
  return out.join("");
}

export function normalizeHanScriptForDisplay(raw: string, mode: OcrDisplayScriptMode): string {
  if (!raw || mode === "leave") return raw;
  const { simpToTrad, tradToSimp } = getHanCharScriptMaps();
  if (mode === "to_trad") return mapByCharTable(raw, simpToTrad);
  return mapByCharTable(raw, tradToSimp);
}

function buildDisplayNormMeta(
  raw: string,
  display: string,
  mode: OcrDisplayScriptMode,
  meta: OcrHanScriptMeta
): OcrDisplayNormalizationMeta {
  const changed = display !== raw;
  if (mode === "leave") {
    const hadMarkers = meta.tradMarkerCount + meta.simpMarkerCount > 0;
    const labelZh = hadMarkers
      ? "繁／簡對照字數量相近，顯示維持引擎原文以利人工核對（未強制整篇轉換）。"
      : "未偵測到表列對照字形，顯示與引擎輸出一致。";
    return { mode: "leave", charSubstitutionsApplied: false, labelZh };
  }
  if (!changed) {
    const labelZh =
      mode === "to_trad"
        ? "判定以繁體為主；顯示與引擎輸出一致，無需替換對照字。"
        : "判定以簡體為主；顯示與引擎輸出一致，無需替換對照字。";
    return { mode, charSubstitutionsApplied: false, labelZh };
  }
  const labelZh =
    mode === "to_trad"
      ? "已將顯示文字調整為以繁體對照字為主（引擎聚合原文仍保留於回應之 text 欄位供除錯）。"
      : "已將顯示文字調整為以簡體對照字為主（引擎聚合原文仍保留於回應之 text 欄位供除錯）。";
  return { mode, charSubstitutionsApplied: true, labelZh };
}

/**
 * 在**不修改** `text`（引擎聚合原文）前提下，產生 `textDisplay` 並同步行／區塊之顯示字串。
 * 品質評分等應在套用前、以原始 `text` 完成。
 */
export function augmentOcrWithDisplayText(detailed: OcrDetailedResult): OcrDetailedResult {
  const raw = detailed.text;
  const meta = detailed.hanScript ?? detectHanScriptSummary(raw);
  const mode = resolveOcrDisplayScriptMode(meta);
  const displayPage = normalizeHanScriptForDisplay(raw, mode);
  const norm = (s: string) => normalizeHanScriptForDisplay(s, mode);

  const lines = detailed.lines.map((l) => ({ ...l, text: norm(l.text) }));
  const blocks = detailed.blocks.map((b) => ({
    ...b,
    text: norm(b.text),
    lines: b.lines.map((ln) => ({ ...ln, text: norm(ln.text) })),
  }));

  const displayNormalization = buildDisplayNormMeta(raw, displayPage, mode, meta);

  return {
    ...detailed,
    text: raw,
    textDisplay: displayPage,
    lines,
    blocks,
    hanScript: meta,
    displayNormalization,
  };
}
