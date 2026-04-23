import type { PdfPageText } from "@/types/analysis";

export const PDF_MAX_PAGES = 50;

/**
 * Server-side PDF text per page via unpdf (serverless-friendly bundle + DOMMatrix stub).
 * Kept in this module so callers can dynamic-import it only on the PDF path.
 */
export async function extractPdfPages(buffer: Buffer): Promise<{
  pages: PdfPageText[];
  pageCount: number;
}> {
  const { getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  try {
    const numPages = pdf.numPages;
    const toRead = Math.min(Math.max(numPages, 1), PDF_MAX_PAGES);
    const pages: PdfPageText[] = [];

    for (let pageNum = 1; pageNum <= toRead; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const content = await page.getTextContent();
      const raw = content.items
        .filter((item) => "str" in item && item.str != null)
        .map((item) => {
          const it = item as { str: string; hasEOL?: boolean };
          return it.str + (it.hasEOL ? "\n" : "");
        })
        .join("");
      const cleaned = raw.replace(/\u0000/g, "").replace(/\s+/g, " ").trim() || " ";
      pages.push({ pageNumber: pageNum, text: cleaned.slice(0, 120_000) });
    }

    if (!pages.length) {
      throw new Error("pdf_no_extractable_pages");
    }

    const pageCount = pdfUnitsFromPageCount(toRead);
    return { pages, pageCount };
  } finally {
    await pdf.destroy().catch(() => undefined);
  }
}

export function pdfUnitsFromPageCount(n: number): number {
  return Math.min(Math.max(n, 1), PDF_MAX_PAGES);
}
