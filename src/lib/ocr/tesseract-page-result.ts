import type { Line, Page } from "tesseract.js";
import type { OcrHanScriptMeta } from "@/lib/ocr/ocr-han-script";

export type { OcrHanScriptMeta } from "@/lib/ocr/ocr-han-script";

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

/** 瀏覽器多軌 OCR 之中繼資料（伺服器 OCR 通常不填） */
export type OcrBrowserPipelineMeta = {
  langsTried: string;
  /** 入選之辨識軌：原圖、預處理圖，或 SPARSE 補強軌（影像來源見 sparseUsedPreprocessed） */
  selectedPass: "original" | "preprocessed" | "sparse";
  /** 僅當 selectedPass 為 sparse：是否對預處理圖執行（否則為原圖） */
  sparseUsedPreprocessed?: boolean;
  preprocessApplied: boolean;
  sparsePassUsed: boolean;
  qualityLevel: "poor" | "fair" | "good";
  qualityReasons: string[];
  /** 品質明顯不佳時之繁中警示 */
  qualityWarningZh?: string;
  /** 尚可但建議複核 */
  qualityCautionZh?: string;
};

/** 字形顯示優化（post-OCR）之中繼說明；引擎原文見 `text` */
export type OcrDisplayNormalizationMeta = {
  mode: "to_trad" | "to_simp" | "leave";
  charSubstitutionsApplied: boolean;
  labelZh: string;
};

/** `/api/ocr/clean` 與 `cleanOcrTextWithOpenAI` 之機器可讀狀態碼 */
export type GptOcrCleanCode =
  | "GPT_CLEAN_OK"
  | "GPT_CLEAN_NO_API_KEY"
  | "GPT_CLEAN_OPENAI_REQUEST_FAILED"
  | "GPT_CLEAN_TIMEOUT"
  | "GPT_CLEAN_INVALID_RESPONSE"
  | "GPT_CLEAN_AUTH_ERROR"
  | "GPT_CLEAN_UNKNOWN_ERROR";

/** GPT 可讀性清理（空格、斷行、雜訊）之中繼說明 */
export type OcrGptCleanupMeta = {
  source: "openai" | "fallback";
  labelZh: string;
  code?: GptOcrCleanCode;
  /** 安全、簡短之除錯說明（不含金鑰） */
  debugMessage?: string;
};

export type OcrDetailedResult = {
  /** Tesseract 聚合之引擎原文（未做字形顯示優化） */
  text: string;
  /** 供介面預設顯示／編輯之字形優化全文；未設定時請使用 `text` */
  textDisplay?: string;
  /** GPT 可讀性清理後全文（供 UI 預設與文字軌分析）；未設定時請用 `textDisplay` 或 `text` */
  textClean?: string;
  /** 整頁代表信心 0–1（有文字之行的行級信心平均；無行則 page.confidence） */
  confidence: number;
  confidencePercent: number;
  blocks: OcrBlockSnippet[];
  lines: OcrLineSnippet[];
  /** 僅瀏覽器 OCR：多軌挑選與品質提示 */
  browserPipeline?: OcrBrowserPipelineMeta;
  /** 依對照字統計之字形摘要（針對引擎原文 `text`） */
  hanScript?: OcrHanScriptMeta;
  /** 顯示層字形優化說明（伺服器／瀏覽器 OCR 皆可填） */
  displayNormalization?: OcrDisplayNormalizationMeta;
  /** GPT OCR 清理層（在 `textDisplay` 之後） */
  gptCleanup?: OcrGptCleanupMeta;
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
