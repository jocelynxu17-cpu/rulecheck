export type RiskSeverity = "high" | "medium" | "low";

export type RiskCategory = "醫療效能" | "誇大" | "誤導" | "其他";

export type TextSpan = { start: number; end: number };

/** 三種改寫語氣（UI 固定標題） */
export type AnalysisRewrites = {
  conservative: string;
  marketing: string;
  ecommerce: string;
};

export type AnalysisFinding = {
  riskyPhrase: string;
  matchedText: string;
  spans: TextSpan[];
  category: RiskCategory;
  riskType: string;
  severity: RiskSeverity;
  /** 法規名稱，例如：公平交易法 */
  lawName: string;
  /** 條號／項次，例如：第21條 */
  article: string;
  /** 一句話說明為何構成風險 */
  reason: string;
  /** 法源補充說明（仍為示意，非釋字） */
  legalReference: string;
  suggestion: string;
  rewrites: AnalysisRewrites;
};

export type AnalysisInputKind = "text" | "image" | "pdf";

export type PdfPageText = { pageNumber: number; text: string };

export type PdfPageAnalysis = {
  pageNumber: number;
  text: string;
  findings: AnalysisFinding[];
  summary: string;
  hasRisk: boolean;
};

export type AnalysisMeta = {
  source: "openai" | "mock";
  guest: boolean;
  quotaRemaining: number | null;
  plan?: string | null;
  workspaceId?: string | null;
  workspaceName?: string | null;
  inputKind?: AnalysisInputKind;
  unitsCharged?: number;
  ocrConfidence?: number | null;
};

export type AnalysisResult = {
  findings: AnalysisFinding[];
  summary: string;
  scannedAt: string;
  meta: AnalysisMeta;
  /** PDF：分頁結果與風險頁碼 */
  pdfReport?: {
    pageCount: number;
    pages: PdfPageAnalysis[];
    riskyPageNumbers: number[];
  };
};
