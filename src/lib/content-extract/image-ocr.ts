import path from "path";
import { createWorker } from "tesseract.js";

async function recognizeWithLangs(buffer: Buffer, langs: string): Promise<{ text: string; confidence: number }> {
  const workerPath = path.join(process.cwd(), "node_modules", "tesseract.js", "dist", "worker.min.js");
  const corePath = path.join(process.cwd(), "node_modules", "tesseract.js-core");

  const worker = await createWorker(langs, 1, {
    logger: () => undefined,
    workerBlobURL: false,
    workerPath,
    corePath,
  });

  try {
    const {
      data: { text, confidence },
    } = await worker.recognize(buffer);
    const cleaned = String(text ?? "")
      .replace(/\s+/g, " ")
      .trim();
    return {
      text: cleaned.slice(0, 80_000),
      confidence: typeof confidence === "number" ? confidence : 0,
    };
  } finally {
    await worker.terminate();
  }
}

/**
 * 圖片 OCR（繁中 + 英文）。Node 環境需關閉 workerBlobURL 並指定 worker／core 路徑。
 * 若 chi_tra+eng 失敗，會退回僅 eng。
 */
export async function ocrImageBuffer(buffer: Buffer): Promise<{ text: string; confidence: number }> {
  try {
    return await recognizeWithLangs(buffer, "chi_tra+eng");
  } catch (e) {
    console.error("[ocr] chi_tra+eng failed, retrying eng only:", e);
    return await recognizeWithLangs(buffer, "eng");
  }
}

export const IMAGE_MAX_BYTES = 10 * 1024 * 1024;
export const PDF_MAX_BYTES = 20 * 1024 * 1024;
