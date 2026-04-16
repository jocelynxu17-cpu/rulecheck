import type {
  AnalysisFinding,
  AnalysisMeta,
  AnalysisResult,
  AnalysisRewrites,
  RiskCategory,
  RiskSeverity,
} from "@/types/analysis";
import { mergeFindingsSpans } from "@/lib/text-spans";

function padRewritesFromArray(arr: string[]): AnalysisRewrites {
  const [a = "", b = "", c = ""] = arr;
  return {
    conservative: a || "（請由法務覆核後再定稿）",
    marketing: b || a || "（請由法務覆核後再定稿）",
    ecommerce: c || b || a || "（請由法務覆核後再定稿）",
  };
}

function inferLawFromLegacy(legalReference: string): { lawName: string; article: string } {
  const t = legalReference.trim();
  const m = t.match(/《([^》]+)》\s*第\s*([0-9０-９]+)\s*條/);
  if (m) return { lawName: m[1] ?? "相關法規", article: `第${m[2]}條` };
  const m2 = t.match(/《([^》]+)》/);
  if (m2) return { lawName: m2[1] ?? "相關法規", article: "—" };
  return { lawName: "相關法規", article: "—" };
}

/** 將舊版 / 不完整 JSON 轉為新版 Finding（供紀錄頁與 API 輸出一致）。 */
export function normalizeFinding(raw: unknown, fullText: string): AnalysisFinding {
  const f = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;

  const riskyPhrase = String(f.riskyPhrase ?? "");
  const matchedText = String(f.matchedText ?? f.riskyPhrase ?? "");
  const category = (["醫療效能", "誇大", "誤導", "其他"].includes(String(f.category))
    ? f.category
    : "其他") as RiskCategory;
  const riskType = String(f.riskType ?? "");
  const severity = (["high", "medium", "low"].includes(String(f.severity)) ? f.severity : "low") as RiskSeverity;

  const legalReference = String(f.legalReference ?? "");
  const inferredLaw = inferLawFromLegacy(legalReference);
  const lawName = String(f.lawName ?? "").trim() || inferredLaw.lawName;
  const article = String(f.article ?? "").trim() || inferredLaw.article;
  const reason =
    String(f.reason ?? "").trim() ||
    (riskType ? `與「${riskType}」相關之表述可能引發合規疑慮。` : "此表述可能涉及合規疑慮，建議由法遵覆核。");

  const suggestion = String(f.suggestion ?? "");

  let rewrites: AnalysisRewrites | null = null;
  const rwObj = f.rewrites as Record<string, unknown> | undefined;

  if (rwObj && typeof rwObj === "object") {
    rewrites = {
      conservative: String(rwObj.conservative ?? ""),
      marketing: String(rwObj.marketing ?? rwObj.marketing_natural ?? ""),
      ecommerce: String(rwObj.ecommerce ?? rwObj.ecommerce_concise ?? ""),
    };
  }

  if (!rewrites || !String(rewrites.conservative).trim()) {
    const legacy = Array.isArray(f.rewriteSuggestions)
      ? (f.rewriteSuggestions as unknown[]).map((x) => String(x))
      : [];
    rewrites = padRewritesFromArray(legacy);
  }

  const spans = Array.isArray(f.spans)
    ? (f.spans as AnalysisFinding["spans"])
    : mergeFindingsSpans(fullText, matchedText, riskyPhrase);

  return {
    riskyPhrase,
    matchedText,
    spans,
    category,
    riskType,
    severity,
    lawName,
    article,
    reason,
    legalReference: legalReference || `${lawName}${article !== "—" ? ` ${article}` : ""}（示意說明）`,
    suggestion,
    rewrites,
  };
}

export function normalizeAnalysisResult(raw: unknown, inputText: string): AnalysisResult {
  const r = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  const findingsRaw = Array.isArray(r.findings) ? r.findings : [];
  const findings = findingsRaw.map((x) => normalizeFinding(x, inputText));
  const summary = String(r.summary ?? "");
  const scannedAt = String(r.scannedAt ?? new Date().toISOString());
  const metaRaw = (r.meta ?? {}) as Record<string, unknown>;

  const normalizedSource: AnalysisMeta["source"] =
    metaRaw.source === "openai" || metaRaw.source === "mock"
      ? metaRaw.source
      : "mock";

  const meta: AnalysisMeta = {
    source: normalizedSource,
    guest: Boolean(metaRaw.guest),
    quotaRemaining:
      typeof metaRaw.quotaRemaining === "number" ? metaRaw.quotaRemaining : null,
    plan: typeof metaRaw.plan === "string" ? metaRaw.plan : null,
  };

  return { findings, summary, scannedAt, meta };
}

export function categorySummary(findings: AnalysisFinding[]): string {
  const set = new Set<RiskCategory>();
  findings.forEach((f) => set.add(f.category));
  const order: RiskCategory[] = ["醫療效能", "誇大", "誤導", "其他"];
  return order.filter((c) => set.has(c)).join("、") || "—";
}

export function analysisStatusLabel(findings: AnalysisFinding[]): string {
  if (!findings.length) return "未偵測到提示";
  return "已偵測到提示";
}