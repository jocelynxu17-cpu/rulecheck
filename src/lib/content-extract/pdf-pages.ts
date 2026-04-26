import type { PdfPageText } from "@/types/analysis";
import { PDF_MAX_PAGES } from "@/lib/analyze/input-limits";
import {
  assessPdfTextLayer,
  normalizePdfPageTextForStorage,
  type PdfTextLayerMetrics,
} from "@/lib/content-extract/pdf-text-layer-quality";

export { PDF_MAX_PAGES };

export type PdfInvalidTextLayerPage = {
  pageNumber: number;
  reasons: string[];
  textLayerLen: number;
  metrics: {
    cjkRatio: number;
    latinRatio: number;
    digitRatio: number;
    replacementRatio: number;
    unusualRatio: number;
  };
};

/** Thrown when one or more pages lack a usable embedded text layer (scanned PDF, garbled layer, etc.). */
export class PdfTextLayerRejectedError extends Error {
  readonly code = "PDF_NO_TEXT_LAYER" as const;
  readonly invalidPages: PdfInvalidTextLayerPage[];

  constructor(invalidPages: PdfInvalidTextLayerPage[]) {
    super("PDF_NO_TEXT_LAYER");
    this.name = "PdfTextLayerRejectedError";
    this.invalidPages = invalidPages;
  }
}

function roundMetrics(m: PdfTextLayerMetrics) {
  return {
    cjkRatio: Number(m.cjkRatio.toFixed(3)),
    latinRatio: Number(m.latinRatio.toFixed(3)),
    digitRatio: Number(m.digitRatio.toFixed(3)),
    replacementRatio: Number(m.replacementRatio.toFixed(4)),
    unusualRatio: Number(m.unusualRatio.toFixed(3)),
  };
}

/**
 * Page-aware PDF text-layer extraction only (no rasterize / OCR).
 * Rejects the whole document if any page is empty or fails quality heuristics.
 */
export async function extractPdfPages(buffer: Buffer): Promise<{
  pages: PdfPageText[];
  pageCount: number;
}> {
  const { getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const numPages = pdf.numPages;
  const toRead = Math.min(Math.max(numPages, 1), PDF_MAX_PAGES);

  console.log("[pdf-extract] document_open", {
    totalPagesInFile: numPages,
    pagesToRead: toRead,
  });

  const rows: PdfPageText[] = [];
  const invalidPages: PdfInvalidTextLayerPage[] = [];

  try {
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

      const storageText = normalizePdfPageTextForStorage(raw);
      const assessment = assessPdfTextLayer(raw);
      const trimmedLen = storageText.trim().length;

      console.log("[pdf-extract] page_text_layer_probe", {
        pageNumber: pageNum,
        useTextLayer: assessment.useTextLayer,
        textLayerLen: trimmedLen,
        reasons: assessment.reasons,
        ...roundMetrics(assessment.metrics),
      });

      const trustTextLayer = assessment.useTextLayer && trimmedLen > 0;

      if (!trustTextLayer) {
        console.log("[pdf-extract] page_rejected_no_usable_text_layer", {
          pageNumber: pageNum,
          reasons: assessment.reasons,
          textLayerLen: trimmedLen,
        });
        invalidPages.push({
          pageNumber: pageNum,
          reasons: assessment.reasons,
          textLayerLen: trimmedLen,
          metrics: roundMetrics(assessment.metrics),
        });
        continue;
      }

      rows.push({
        pageNumber: pageNum,
        text: storageText.slice(0, 120_000),
      });
    }

    if (invalidPages.length > 0) {
      console.log("[pdf-extract] document_rejected", {
        invalidPageCount: invalidPages.length,
        totalPagesRead: toRead,
        invalidPages,
      });
      throw new PdfTextLayerRejectedError(invalidPages);
    }

    if (!rows.length) {
      throw new Error("pdf_no_extractable_pages");
    }

    const pageCount = pdfUnitsFromPageCount(toRead);
    console.log("[pdf-extract] done", {
      pageCount,
      pagesReturned: rows.length,
    });

    return { pages: rows, pageCount };
  } finally {
    await pdf.destroy().catch(() => undefined);
  }
}

export function pdfUnitsFromPageCount(n: number): number {
  return Math.min(Math.max(n, 1), PDF_MAX_PAGES);
}
