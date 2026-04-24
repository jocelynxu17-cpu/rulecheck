"use client";

import type { Page } from "tesseract.js";
import { pageToDetailed, type OcrDetailedResult } from "@/lib/ocr/tesseract-page-result";

/**
 * 於瀏覽器執行 Tesseract（避免 Vercel serverless OCR 逾時）。
 * 先 chi_tra+eng，失敗再 eng。
 */
export async function runBrowserOcrDetailed(
  file: File,
  options?: { onProgress?: (ratio: number) => void }
): Promise<OcrDetailedResult> {
  const Tesseract = await import("tesseract.js");
  const onProgress = options?.onProgress;

  async function runLang(lang: string): Promise<OcrDetailedResult> {
    const worker = await Tesseract.createWorker(lang, 1, {
      logger: (m) => {
        if (typeof m.progress === "number" && (m.status === "recognizing text" || m.status === "loading tesseract core")) {
          onProgress?.(Math.min(1, Math.max(0, m.progress)));
        }
      },
    });
    try {
      await worker.setParameters({
        tessedit_pageseg_mode: Tesseract.PSM.AUTO,
        user_defined_dpi: "300",
      });
      const { data } = await worker.recognize(file, {}, { blocks: true } as Parameters<typeof worker.recognize>[2]);
      return pageToDetailed(data as Page, 120);
    } finally {
      await worker.terminate();
    }
  }

  try {
    return await runLang("chi_tra+eng");
  } catch (first) {
    console.warn("[ocr-browser] chi_tra+eng failed, retry eng:", first);
    return await runLang("eng");
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
