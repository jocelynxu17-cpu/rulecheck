import { PDFParse } from "pdf-parse";
import type { PdfPageText } from "@/types/analysis";

export const PDF_MAX_PAGES = 50;

/**
 * 以 pdf-parse v2（PDFParse + pdfjs）擷取每頁文字。
 * v1「直接呼叫 default(buffer)」與 v2 套件不相容，會導致執行期失敗。
 */
export async function extractPdfPages(buffer: Buffer): Promise<{
  pages: PdfPageText[];
  pageCount: number;
}> {
  const parser = new PDFParse({ data: buffer });
  try {
    const textResult = await parser.getText();
    const totalRaw = textResult.total ?? 0;
    const totalPages = Math.min(Math.max(totalRaw, 1), PDF_MAX_PAGES);

    let pages: PdfPageText[] = (textResult.pages ?? [])
      .filter((p) => p.num <= PDF_MAX_PAGES)
      .map((p) => ({
        pageNumber: p.num,
        text: String(p.text ?? "")
          .replace(/\u0000/g, "")
          .replace(/\s+/g, " ")
          .trim() || " ",
      }));

    if (!pages.length && String(textResult.text ?? "").trim()) {
      const flat = String(textResult.text)
        .replace(/\u0000/g, "")
        .replace(/\s+/g, " ")
        .trim();
      pages = [{ pageNumber: 1, text: flat.slice(0, 120_000) || " " }];
    }

    if (!pages.length) {
      throw new Error("pdf_no_extractable_pages");
    }

    const pageCount = pdfUnitsFromPageCount(totalPages);
    return { pages, pageCount };
  } finally {
    await parser.destroy().catch(() => undefined);
  }
}

export function pdfUnitsFromPageCount(n: number): number {
  return Math.min(Math.max(n, 1), PDF_MAX_PAGES);
}
