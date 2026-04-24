"use client";

import type { Page } from "tesseract.js";
import {
  pageToDetailed,
  type OcrBrowserPipelineMeta,
  type OcrDetailedResult,
} from "@/lib/ocr/tesseract-page-result";
import { preprocessImageFileForOcr } from "@/lib/ocr/ocr-preprocess";
import {
  assessOcrQuality,
  buildOcrQualityCautionZh,
  buildOcrQualityWarningZh,
  meritForCandidate,
} from "@/lib/ocr/ocr-quality";

const OCR_MAX_LINES = 420;

const LANGS_FULL = "chi_tra+chi_sim+eng";
const LANGS_FALLBACK = "chi_tra+eng";
const LANGS_ENG = "eng";

type LoggerMsg = { progress?: number; status?: string };
type SelectedPass = "original" | "preprocessed" | "sparse";

function pickBestByMerit(
  candidates: { detailed: OcrDetailedResult; pass: SelectedPass }[]
): { detailed: OcrDetailedResult; pass: SelectedPass } {
  let best = candidates[0]!;
  let bestMerit = meritForCandidate(best.detailed.text, best.detailed.confidence);
  for (let i = 1; i < candidates.length; i++) {
    const c = candidates[i]!;
    const m = meritForCandidate(c.detailed.text, c.detailed.confidence);
    if (m > bestMerit + 0.006) {
      best = c;
      bestMerit = m;
    } else if (Math.abs(m - bestMerit) <= 0.006) {
      const lenA = best.detailed.text.replace(/\s+/g, "").length;
      const lenB = c.detailed.text.replace(/\s+/g, "").length;
      if (lenB > lenA * 1.04) {
        best = c;
        bestMerit = m;
      } else if (Math.abs(lenB - lenA) <= lenA * 0.04 && c.detailed.confidence > best.detailed.confidence + 0.02) {
        best = c;
        bestMerit = m;
      }
    }
  }
  return best;
}

async function runOcrWithSingleWorker(
  Tesseract: typeof import("tesseract.js"),
  file: File,
  preprocessBlob: Blob | null,
  langs: string,
  onProgress: ((ratio: number) => void) | undefined
): Promise<OcrDetailedResult> {
  let progLo = 0;
  let progHi = 1;
  const logger = (m: LoggerMsg) => {
    if (typeof m.progress === "number" && (m.status === "recognizing text" || m.status === "loading tesseract core")) {
      const t = Math.min(1, Math.max(0, m.progress));
      onProgress?.(progLo + t * (progHi - progLo));
    }
  };

  const worker = await Tesseract.createWorker(langs, 1, { logger });

  type PageSeg = typeof Tesseract.PSM.AUTO | typeof Tesseract.PSM.SPARSE_TEXT;

  const runRecognize = async (image: File | Blob, psm: PageSeg): Promise<OcrDetailedResult> => {
    await worker.setParameters({
      tessedit_pageseg_mode: psm,
      user_defined_dpi: "300",
    });
    const { data } = await worker.recognize(image, {}, { blocks: true } as Parameters<typeof worker.recognize>[2]);
    return pageToDetailed(data as Page, OCR_MAX_LINES);
  };

  try {
    const round1: { detailed: OcrDetailedResult; pass: SelectedPass }[] = [];

    if (!preprocessBlob) {
      progLo = 0;
      progHi = 0.82;
      round1.push({ detailed: await runRecognize(file, Tesseract.PSM.AUTO), pass: "original" });
    } else {
      progLo = 0;
      progHi = 0.38;
      round1.push({ detailed: await runRecognize(file, Tesseract.PSM.AUTO), pass: "original" });

      progLo = 0.38;
      progHi = 0.76;
      round1.push({ detailed: await runRecognize(preprocessBlob, Tesseract.PSM.AUTO), pass: "preprocessed" });
    }

    let best = pickBestByMerit(round1);
    let sparsePassUsed = false;
    const meritBest = meritForCandidate(best.detailed.text, best.detailed.confidence);

    if (meritBest < 0.44) {
      progLo = preprocessBlob ? 0.76 : 0.82;
      progHi = 1;
      const sparseImage = preprocessBlob ?? file;
      try {
        const sparse = await runRecognize(sparseImage, Tesseract.PSM.SPARSE_TEXT);
        sparsePassUsed = true;
        best = pickBestByMerit([...round1, { detailed: sparse, pass: "sparse" }]);
      } catch (e) {
        console.warn("[ocr-browser] sparse pass failed:", e);
      }
    }

    onProgress?.(1);

    const assessment = assessOcrQuality(best.detailed.text, best.detailed.confidence);
    const browserPipeline: OcrBrowserPipelineMeta = {
      langsTried: langs,
      selectedPass: best.pass,
      sparseUsedPreprocessed: best.pass === "sparse" ? Boolean(preprocessBlob) : undefined,
      preprocessApplied: preprocessBlob != null,
      sparsePassUsed,
      qualityLevel: assessment.level,
      qualityReasons: assessment.reasons,
      qualityWarningZh: buildOcrQualityWarningZh(assessment),
      qualityCautionZh: buildOcrQualityCautionZh(assessment),
    };

    return { ...best.detailed, browserPipeline };
  } finally {
    await worker.terminate().catch(() => undefined);
  }
}

/**
 * 於瀏覽器執行 Tesseract。
 * 語系：chi_tra + chi_sim + eng（失敗則 chi_tra+eng，再失敗則 eng）。
 * 多軌：原圖 AUTO、預處理圖 AUTO；merit 仍偏低時加跑預處理圖 SPARSE_TEXT，三者取最佳。
 */
export async function runBrowserOcrDetailed(
  file: File,
  options?: { onProgress?: (ratio: number) => void }
): Promise<OcrDetailedResult> {
  const Tesseract = await import("tesseract.js");
  const onProgress = options?.onProgress;

  let preprocessBlob: Blob | null = null;
  try {
    preprocessBlob = await preprocessImageFileForOcr(file);
  } catch (e) {
    console.warn("[ocr-browser] preprocess skipped:", e);
  }

  try {
    return await runOcrWithSingleWorker(Tesseract, file, preprocessBlob, LANGS_FULL, onProgress);
  } catch (first) {
    console.warn("[ocr-browser] primary langs failed:", first);
    try {
      return await runOcrWithSingleWorker(Tesseract, file, preprocessBlob, LANGS_FALLBACK, onProgress);
    } catch (second) {
      console.warn("[ocr-browser] fallback chi_tra+eng failed, retry eng:", second);
      return await runOcrWithSingleWorker(Tesseract, file, preprocessBlob, LANGS_ENG, onProgress);
    }
  }
}

export function formatBrowserOcrError(e: unknown): { code: string; message: string } {
  if (e instanceof Error) {
    return {
      code: "BROWSER_OCR_FAILED",
      message: e.message.trim() || "瀏覽器端文字辨識失敗。",
    };
  }
  return { code: "BROWSER_OCR_FAILED", message: String(e) };
}
