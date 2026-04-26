/**
 * Heuristics for deciding whether a PDF page's embedded text layer is trustworthy
 * vs. falling back to rasterize + OCR (scanned pages, broken encodings, etc.).
 */

export type PdfTextLayerMetrics = {
  length: number;
  cjkRatio: number;
  latinRatio: number;
  digitRatio: number;
  spaceRatio: number;
  replacementRatio: number;
  privateUseRatio: number;
  controlRatio: number;
  /** Share of chars that are not common printable / whitespace / CJK / Latin / digit / common punct */
  unusualRatio: number;
};

export type PdfTextLayerAssessment = {
  /** When true, use embedded text for compliance; when false, prefer OCR if available */
  useTextLayer: boolean;
  reasons: string[];
  metrics: PdfTextLayerMetrics;
};

const CJK_RE = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/;
const LATIN_RE = /[A-Za-z]/;
const DIGIT_RE = /\d/;
const COMMON_PUNCT_RE = /[.,;:!?'"「」『』（）【】、。；：？！…—\-–·•%℃°＆&@#+=_/\\|<>[\]{}~`$€¥£]/;

function isPrivateUse(code: number): boolean {
  return (code >= 0xe000 && code <= 0xf8ff) || (code >= 0xf0000 && code <= 0xfffff);
}

function isControlExceptWs(code: number): boolean {
  return (code < 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d) || code === 0x7f;
}

/** Normalize extracted PDF text for measurement (keep newlines; trim NUL). */
export function normalizePdfPageTextForQuality(raw: string): string {
  return raw.replace(/\u0000/g, "").replace(/\r\n/g, "\n").trim();
}

/** Collapse whitespace runs for downstream compliance text (max length cap applied by caller). */
export function normalizePdfPageTextForStorage(raw: string): string {
  const t = raw.replace(/\u0000/g, "").replace(/\r\n/g, "\n");
  const collapsed = t.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n");
  return collapsed.trim();
}

export function measurePdfTextLayer(text: string): PdfTextLayerMetrics {
  const s = text;
  const len = s.length;
  if (len === 0) {
    return {
      length: 0,
      cjkRatio: 0,
      latinRatio: 0,
      digitRatio: 0,
      spaceRatio: 0,
      replacementRatio: 0,
      privateUseRatio: 0,
      controlRatio: 0,
      unusualRatio: 0,
    };
  }

  let cjk = 0;
  let latin = 0;
  let digit = 0;
  let space = 0;
  let replacement = 0;
  let pua = 0;
  let control = 0;
  let unusual = 0;

  for (const ch of s) {
    const code = ch.codePointAt(0)!;
    if (code === 0xfffd) {
      replacement += 1;
      unusual += 1;
      continue;
    }
    if (isPrivateUse(code)) {
      pua += 1;
      unusual += 1;
      continue;
    }
    if (isControlExceptWs(code)) {
      control += 1;
      unusual += 1;
      continue;
    }
    if (ch === " " || ch === "\n" || ch === "\t" || ch === "\r") {
      space += 1;
      continue;
    }
    if (CJK_RE.test(ch)) {
      cjk += 1;
      continue;
    }
    if (LATIN_RE.test(ch)) {
      latin += 1;
      continue;
    }
    if (DIGIT_RE.test(ch)) {
      digit += 1;
      continue;
    }
    if (COMMON_PUNCT_RE.test(ch)) {
      continue;
    }
    unusual += 1;
  }

  return {
    length: len,
    cjkRatio: cjk / len,
    latinRatio: latin / len,
    digitRatio: digit / len,
    spaceRatio: space / len,
    replacementRatio: replacement / len,
    privateUseRatio: pua / len,
    controlRatio: control / len,
    unusualRatio: unusual / len,
  };
}

/**
 * Decide if embedded text is likely usable for compliance analysis.
 * Biased toward OCR when uncertain (scanned PDFs often expose junk text layers).
 */
export function assessPdfTextLayer(text: string): PdfTextLayerAssessment {
  const normalized = normalizePdfPageTextForQuality(text);
  const metrics = measurePdfTextLayer(normalized);
  const reasons: string[] = [];
  const { length: len, cjkRatio, latinRatio, digitRatio, replacementRatio, privateUseRatio, unusualRatio } = metrics;
  const letterLike = cjkRatio + latinRatio;
  const contentish = letterLike + digitRatio;

  if (len === 0) {
    reasons.push("empty_after_trim");
    return { useTextLayer: false, reasons, metrics };
  }

  if (replacementRatio > 0.02 || privateUseRatio > 0.02) {
    reasons.push("high_replacement_or_pua");
    return { useTextLayer: false, reasons, metrics };
  }

  if (unusualRatio > 0.18) {
    reasons.push("high_unusual_char_ratio");
    return { useTextLayer: false, reasons, metrics };
  }

  if (len < 12 && contentish < 0.25) {
    reasons.push("very_short_low_content_signal");
    return { useTextLayer: false, reasons, metrics };
  }

  if (len < 40) {
    if (letterLike < 0.12 && digitRatio < 0.08) {
      reasons.push("short_page_low_cjk_latin");
      return { useTextLayer: false, reasons, metrics };
    }
    if (unusualRatio > 0.08) {
      reasons.push("short_page_elevated_noise");
      return { useTextLayer: false, reasons, metrics };
    }
    reasons.push("short_but_acceptable");
    return { useTextLayer: true, reasons, metrics };
  }

  if (len < 200) {
    if (letterLike < 0.08 && unusualRatio > 0.06) {
      reasons.push("medium_len_low_letters_with_noise");
      return { useTextLayer: false, reasons, metrics };
    }
    if (letterLike < 0.06 && digitRatio < 0.15) {
      reasons.push("medium_len_sparse_alphanumeric");
      return { useTextLayer: false, reasons, metrics };
    }
    reasons.push("medium_len_ok");
    return { useTextLayer: true, reasons, metrics };
  }

  if (letterLike < 0.04 && unusualRatio > 0.05) {
    reasons.push("long_low_letter_signal_high_noise");
    return { useTextLayer: false, reasons, metrics };
  }

  reasons.push("long_page_default_accept");
  return { useTextLayer: true, reasons, metrics };
}
