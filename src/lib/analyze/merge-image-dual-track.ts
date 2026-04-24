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
 * 合併「圖像 vision」與「OCR 文字合規」兩軌，維持單一 findings／summary 供既有 UI；
 * 並附上 `imageDualTrack` 供分區顯示。
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
  const mergedFindings = dedupeFindings([...vf, ...tf]);

  const visionSum = vision?.summary?.trim() || "";
  const textSum = textPass?.summary?.trim() || "";

  let summary: string;
  if (visionSum && textSum) {
    summary = `【圖像辨識】${visionSum}\n\n【文字軌（OCR／可編輯）】${textSum}`;
  } else if (visionSum) {
    summary =
      visionSum +
      (ocrSupportText.trim()
        ? "\n\n（已併入圖像分析；文字軌可作對照。）"
        : "\n\n（未提供 OCR 文字；僅以圖像分析為主。）");
  } else if (textSum) {
    summary = `【文字軌】${textSum}\n\n（圖像 AI 未回傳結果或未啟用。）`;
  } else {
    summary = "未產出具體風險摘要；請檢查圖檔或稍後再試。";
  }

  const visionOpenai = vision?.meta?.source === "openai";
  const textOpenai = textPass?.meta?.source === "openai";
  const source: AnalysisMeta["source"] =
    mergedFindings.length === 0 ? "mock" : visionOpenai || textOpenai ? "openai" : "mock";

  const scannedAt = vision?.scannedAt || textPass?.scannedAt || new Date().toISOString();

  const raw: AnalysisResult = {
    findings: mergedFindings,
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
