/**
 * 瀏覽器 OCR 品質評估：用於多軌結果挑選與 UI 警示（繁中文案於 consumer）。
 */

const CJK_RE = /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/g;

export type OcrQualityLevel = "poor" | "fair" | "good";

export type OcrQualityAssessment = {
  level: OcrQualityLevel;
  /** 0–1，愈高愈適合作為候選勝出 */
  merit: number;
  /** 內部／除錯用短標籤 */
  reasons: string[];
};

function countCjk(text: string): number {
  const m = text.match(CJK_RE);
  return m ? m.length : 0;
}

/** 異常符號、替換字元、過多非文字符號之粗略比例 0–1（高＝差） */
export function garbledNoiseRatio(text: string): number {
  const t = text.replace(/\s+/g, "");
  if (!t.length) return 1;
  let bad = 0;
  for (let i = 0; i < t.length; i++) {
    const c = t.charCodeAt(i);
    if (c === 0xfffd) {
      bad += 2;
      continue;
    }
    const ch = t[i]!;
    // 常見 OCR 垃圾符號串
    if ("|¦§¨°".includes(ch)) bad += 0.5;
    if (ch === "~" && t[i + 1] === "~") bad += 0.5;
  }
  const weird = (t.match(/[^\w\s\u3000-\u303f\u3400-\u9fff\uff00-\uffef.,;:!?'"()[\]/%+\-=@#&]/gi) ?? []).length;
  bad += weird;
  return Math.min(1, bad / Math.max(12, t.length * 0.35));
}

/**
 * 綜合信心、長度、中文覆蓋、雜訊，產生可比較之 merit（愈高愈好）。
 */
export function assessOcrQuality(text: string, confidence01: number): OcrQualityAssessment {
  const trimmed = text.replace(/\s+/g, " ").trim();
  const len = trimmed.length;
  const cjk = countCjk(trimmed);
  const noise = garbledNoiseRatio(trimmed);
  const cjkRatio = len > 0 ? cjk / len : 0;

  const reasons: string[] = [];
  let penalty = 0;

  if (!Number.isFinite(confidence01) || confidence01 < 0.32) {
    penalty += 0.12;
    reasons.push("信心偏低");
  }
  if (len < 6) {
    penalty += 0.22;
    reasons.push("字數過少");
  } else if (len < 20) {
    penalty += 0.06;
    reasons.push("字數偏少");
  }

  if (noise > 0.38) {
    penalty += 0.2;
    reasons.push("雜訊符號偏多");
  } else if (noise > 0.22) {
    penalty += 0.08;
    reasons.push("雜訊符號略多");
  }

  // 長文案卻幾乎無中文：常見於混碼或辨識失敗
  if (len > 42 && cjkRatio < 0.05 && cjk < 4) {
    penalty += 0.14;
    reasons.push("中文比例異常低");
  }

  const lenScore = Math.min(1, len / 320);
  const conf = Math.min(1, Math.max(0, confidence01));
  const cjkScore = Math.min(1, cjkRatio * 2.2 + (cjk >= 8 ? 0.15 : 0));
  const noisePenalty = noise * 0.45;

  const merit = Math.max(
    0,
    conf * 0.34 + lenScore * 0.28 + cjkScore * 0.22 + (1 - noise) * 0.16 - penalty - noisePenalty
  );

  const level: OcrQualityLevel = merit < 0.3 ? "poor" : merit < 0.48 ? "fair" : "good";

  return { level, merit, reasons };
}

export function meritForCandidate(text: string, confidence01: number): number {
  return assessOcrQuality(text, confidence01).merit;
}

export function buildOcrQualityWarningZh(assessment: OcrQualityAssessment): string | undefined {
  if (assessment.level !== "poor") return undefined;
  const hint = assessment.reasons.length ? `（${assessment.reasons.slice(0, 3).join("；")}）` : "";
  return `擷取文字品質可能不佳，請務必人工核對或手動修正；信心分數不足以代表內容正確。${hint}`;
}

export function buildOcrQualityCautionZh(assessment: OcrQualityAssessment): string | undefined {
  if (assessment.level !== "fair") return undefined;
  const hint = assessment.reasons.length ? `（${assessment.reasons.slice(0, 2).join("；")}）` : "";
  return `辨識結果建議再核對一次後再送檢。${hint}`;
}
