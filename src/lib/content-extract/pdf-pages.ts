import type { PdfPageText } from "@/types/analysis";

export const PDF_MAX_PAGES = 50;

/**
 * Extracts text from a PDF buffer. Prefers form-feed page breaks when present;
 * otherwise analyzes as a single segment while still reporting `pageCount` for billing.
 */
export async function extractPdfPages(buffer: Buffer): Promise<{
  pages: PdfPageText[];
  pageCount: number;
}> {
  const mod = (await import("pdf-parse")) as unknown as Record<string, unknown>;
  const pdfParse = (typeof mod.default === "function" ? mod.default : mod) as (
    b: Buffer
  ) => Promise<{ text: string; numpages?: number }>;
  const data = await pdfParse(buffer);
  const pageCount = Math.min(Math.max(data.numpages ?? 1, 1), PDF_MAX_PAGES);
  const raw = String(data.text ?? "").replace(/\u0000/g, "");
  const split = raw
    .split(/\f/)
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter((s) => s.length > 0);

  let pages: PdfPageText[];
  if (split.length >= pageCount) {
    pages = split.slice(0, pageCount).map((text, i) => ({ pageNumber: i + 1, text }));
  } else if (split.length > 1) {
    pages = split.map((text, i) => ({ pageNumber: i + 1, text }));
  } else {
    pages = [{ pageNumber: 1, text: raw.slice(0, 120_000).trim() || "（無法擷取文字）" }];
  }

  return { pages, pageCount };
}

export function pdfUnitsFromPageCount(n: number): number {
  return Math.min(Math.max(n, 1), PDF_MAX_PAGES);
}
