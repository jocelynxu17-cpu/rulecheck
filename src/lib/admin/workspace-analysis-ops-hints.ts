import { normalizeAnalysisResult } from "@/lib/analysis-normalize";
import type { ImageDualTrackReport } from "@/types/analysis";

/**
 * 從單筆 analysis_logs.result 萃取出營運可讀的提示（不捏造；僅依既有 JSON）。
 * 可多筆同時存在（例如後備管線 + OCR 偏低）。
 */
export function collectAnalysisOpsHintsFromResult(
  rawResult: unknown,
  inputText: string,
  inputType: string | null
): string[] {
  const hints: string[] = [];
  const normalized = normalizeAnalysisResult(rawResult, inputText ?? "");
  const raw = (typeof rawResult === "object" && rawResult !== null ? rawResult : {}) as Record<string, unknown>;

  const meta = normalized.meta;
  if (meta.source === "mock" && !meta.guest) {
    hints.push("規則／後備管線（非 OpenAI）");
  }

  if (typeof meta.ocrConfidence === "number" && meta.ocrConfidence < 0.35) {
    hints.push(`OCR 信心偏低（${Math.round(meta.ocrConfidence * 100)}%）`);
  }

  const kind = (inputType ?? meta.inputKind ?? "").toLowerCase();
  const pdfRep = normalized.pdfReport;
  if ((kind === "pdf" || meta.inputKind === "pdf") && pdfRep?.pages?.length) {
    const emptyLike = pdfRep.pages.filter((p) => !String(p.text ?? "").trim()).length;
    if (emptyLike > 0) {
      hints.push(`PDF ${emptyLike} 頁無文字／需 OCR`);
    }
  }

  const dual = raw.imageDualTrack as ImageDualTrackReport | undefined;
  if (dual && String(dual.ocrSupportText ?? "").trim().length < 12 && kind === "image") {
    hints.push("圖片文字軌偏短（請確認 OCR）");
  }

  return hints;
}

export function mergeHintLabels(labels: string[]): string {
  const u = [...new Set(labels.filter(Boolean))];
  if (u.length === 0) return "—";
  return u.slice(0, 3).join(" · ");
}
