import { normalizeAnalysisResult } from "@/lib/analysis-normalize";
import type { AnalysisFinding, AnalysisMeta, AnalysisResult, ImageDualTrackReport } from "@/types/analysis";

function dedupeFindings(findings: AnalysisFinding[]): AnalysisFinding[] {
  const seen = new Set<string>();
  const out: AnalysisFinding[] = [];
  for (const f of findings) {
    const k = `${f.riskyPhrase}::${f.matchedText}::${f.category}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(f);
  }
  return out;
}

/**
 * 合併「圖像 vision」與「OCR 文字合規」兩軌：
 * - 圖像 AI 有回傳時：`findings`／`summary` 以 vision 為主軌，不依 OCR 品質決定主結果；
 * - 文字軌僅作選讀驗證，置於 `imageDualTrack.textPassFindings`（不併入主 findings）。
 * - 圖像 AI 不可用且僅有 OCR 時：退回文字軌為主（後援）。
 */
export function mergeImageDualTrackAnalysis(args: {
  vision: AnalysisResult | null;
  textPass: AnalysisResult | null;
  ocrSupportText: string;
  ocrConfidence: number | null;
  metaPatch: Partial<AnalysisMeta>;
}): AnalysisResult {
  const { vision, textPass, ocrSupportText, ocrConfidence, metaPatch } = args;
  const vf = vision?.findings ?? [];
  const tf = textPass?.findings ?? [];
  const visionAvailable = Boolean(vision);

  const visionSum = vision?.summary?.trim() || "";
  const textSum = textPass?.summary?.trim() || "";

  /** 主清單：vision-first；無圖像結果時才以 OCR 文字軌為主 */
  const primaryFindings = visionAvailable ? dedupeFindings(vf) : dedupeFindings(tf);
  const textPassFindingsForReport =
    visionAvailable && tf.length > 0 ? dedupeFindings(tf) : undefined;

  let summary: string;
  if (visionSum) {
    summary = visionSum;
    if (textPassFindingsForReport?.length) {
      summary += `\n\n（另以 OCR／編輯文字做輔助驗證時曾偵測 ${textPassFindingsForReport.length} 項，詳見「文字軌合規驗證」；主判讀與主清單仍以圖像 AI 為準。）`;
    } else if (ocrSupportText.trim()) {
      summary += `\n\n（已附 OCR／編輯文字作對照層，不作主判讀依據。）`;
    } else {
      summary += `\n\n（未附 OCR／編輯文字；合規判讀完全依圖像 AI。）`;
    }
  } else if (textSum) {
    summary = `【OCR／編輯文字參考軌】${textSum}\n\n（圖像 AI 未回傳或未啟用；以上僅依文字參考軌，建議換圖或稍後再試圖像分析。）`;
  } else {
    summary = "未產出具體風險摘要；請檢查圖檔或稍後再試。";
  }

  const visionOpenai = vision?.meta?.source === "openai";
  const textOpenai = textPass?.meta?.source === "openai";
  const source: AnalysisMeta["source"] =
    primaryFindings.length === 0
      ? "mock"
      : visionAvailable
        ? visionOpenai
          ? "openai"
          : "mock"
        : visionOpenai || textOpenai
          ? "openai"
          : "mock";

  const scannedAt = vision?.scannedAt || textPass?.scannedAt || new Date().toISOString();

  const raw: AnalysisResult = {
    findings: primaryFindings,
    summary,
    scannedAt,
    meta: {
      source,
      guest: false,
      quotaRemaining: metaPatch.quotaRemaining ?? null,
      ocrConfidence,
      inputKind: "image",
      ...metaPatch,
    },
  };

  const normalized = normalizeAnalysisResult(raw, ocrSupportText.trim() || " ");

  const imageDualTrack: ImageDualTrackReport = {
    visionSummary: visionSum || "（無）",
    visionFindings: vf,
    ocrSupportText,
    ocrConfidence,
    textPassSummary: textSum || undefined,
    textPassFindingsCount: tf.length,
    textPassFindings: textPassFindingsForReport,
  };

  return {
    ...normalized,
    meta: {
      ...normalized.meta,
      ...metaPatch,
      ocrConfidence,
      inputKind: "image",
    },
    analyzedText: ocrSupportText.trim() || undefined,
    imageDualTrack,
  };
}
