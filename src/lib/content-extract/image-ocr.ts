import { createWorker } from "tesseract.js";

/**
 * Runs OCR (繁中 + 英文) on an image buffer. Heavy — use only from API routes.
 */
export async function ocrImageBuffer(buffer: Buffer): Promise<{ text: string; confidence: number }> {
  const worker = await createWorker("chi_tra+eng", 1, {
    logger: () => undefined,
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

export const IMAGE_MAX_BYTES = 10 * 1024 * 1024;
export const PDF_MAX_BYTES = 20 * 1024 * 1024;
