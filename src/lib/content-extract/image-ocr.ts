import path from "path";
import Tesseract from "tesseract.js";
import { pageToDetailed, type OcrDetailedResult } from "@/lib/ocr/tesseract-page-result";
import { detectHanScriptSummary } from "@/lib/ocr/ocr-han-script";
import { augmentOcrWithDisplayText } from "@/lib/ocr/ocr-script-normalize";
import { enrichOcrWithGptCleanup } from "@/lib/ocr/ocr-gpt-cleanup";

export type {
  OcrDetailedResult,
  OcrLineSnippet,
  OcrBlockSnippet,
  OcrGptCleanupMeta,
} from "@/lib/ocr/tesseract-page-result";
export { normalizeOcrConfidence } from "@/lib/ocr/tesseract-page-result";

async function recognizeWithLangs(buffer: Buffer, langs: string): Promise<OcrDetailedResult> {
  const workerPath = path.join(process.cwd(), "node_modules", "tesseract.js", "dist", "worker.min.js");
  const corePath = path.join(process.cwd(), "node_modules", "tesseract.js-core");

  const worker = await Tesseract.createWorker(langs, 1, {
    logger: () => undefined,
    workerBlobURL: false,
    workerPath,
    corePath,
  });

  try {
    await worker.setParameters({
      tessedit_pageseg_mode: Tesseract.PSM.AUTO,
      user_defined_dpi: "300",
    });

    const {
      data: page,
    } = await worker.recognize(buffer, {}, { blocks: true } as Parameters<typeof worker.recognize>[2]);

    const detailed = pageToDetailed(page, 420);
    const hanScript = detectHanScriptSummary(detailed.text);
    const augmented = augmentOcrWithDisplayText({ ...detailed, hanScript });
    return await enrichOcrWithGptCleanup(augmented);
  } finally {
    await worker.terminate();
  }
}

/**
 * 圖片 OCR（繁中 + 簡中 + 英文）。Node 環境需關閉 workerBlobURL 並指定 worker／core 路徑。
 * 若 chi_tra+chi_sim+eng 失敗則 chi_tra+eng，再失敗則僅 eng。
 * 主要供未帶客戶端 ocrText 之後援；正式流程應以瀏覽器 OCR 為主。
 */
export async function ocrImageBuffer(buffer: Buffer): Promise<{
  text: string;
  /** 引擎聚合原文（未套用顯示層字形優化） */
  textRaw: string;
  confidence: number;
}> {
  const detailed = await ocrImageBufferDetailed(buffer);
  return {
    text: detailed.textClean ?? detailed.textDisplay ?? detailed.text,
    textRaw: detailed.text,
    confidence: detailed.confidence,
  };
}

/** 完整 OCR（僅伺服器／除錯用）。 */
export async function ocrImageBufferDetailed(buffer: Buffer): Promise<OcrDetailedResult> {
  try {
    return await recognizeWithLangs(buffer, "chi_tra+chi_sim+eng");
  } catch (e) {
    console.error("[ocr] chi_tra+chi_sim+eng failed, retrying chi_tra+eng:", e);
    try {
      return await recognizeWithLangs(buffer, "chi_tra+eng");
    } catch (e2) {
      console.error("[ocr] chi_tra+eng failed, retrying eng only:", e2);
      return await recognizeWithLangs(buffer, "eng");
    }
  }
}

export const IMAGE_MAX_BYTES = 10 * 1024 * 1024;
export const PDF_MAX_BYTES = 20 * 1024 * 1024;
