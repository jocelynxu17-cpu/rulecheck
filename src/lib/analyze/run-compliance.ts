import { analyzeWithOpenAI } from "@/lib/analyzer-openai";
import { analyzeTextMock } from "@/lib/analyzer-mock";
import { normalizeAnalysisResult } from "@/lib/analysis-normalize";
import type { AnalysisFinding, AnalysisMeta, AnalysisResult } from "@/types/analysis";

function dedupeFindings(findings: AnalysisFinding[]): AnalysisFinding[] {
  const seen = new Set<string>();
  const out: AnalysisFinding[] = [];
  for (const f of findings) {
    const k = `${f.riskyPhrase}::${f.matchedText}::${f.category}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(f);
  }
  return out;
}

/** 規則式結果先併入，再併入 OpenAI，去重後保留兩邊互補的命中。 */
function mergeRuleAndOpenAI(ruleResult: AnalysisResult, openaiResult: AnalysisResult | null): AnalysisResult {
  if (!openaiResult) {
    return ruleResult;
  }

  const mergedFindings = dedupeFindings([...ruleResult.findings, ...openaiResult.findings]);
  const n = mergedFindings.length;
  const summary =
    n === 0
      ? openaiResult.summary?.trim() || ruleResult.summary
      : n === ruleResult.findings.length && openaiResult.findings.length === 0
        ? ruleResult.summary
        : `偵測到 ${n} 項風險提示（含關鍵字規則${openaiResult.findings.length ? "與模型檢視" : ""}），建議逐條檢視並留存佐證。`;

  const source: AnalysisMeta["source"] =
    mergedFindings.length === 0 ? "mock" : openaiResult.findings.length > 0 ? "openai" : "mock";

  return {
    findings: mergedFindings,
    summary,
    scannedAt: openaiResult.scannedAt || ruleResult.scannedAt,
    meta: {
      ...openaiResult.meta,
      source,
    },
  };
}

export async function runComplianceAnalysis(
  text: string,
  metaPatch: Partial<AnalysisMeta>
): Promise<AnalysisResult> {
  const trimmed = text ?? "";
  const ruleResult = analyzeTextMock(trimmed);

  let openaiResult: AnalysisResult | null = null;
  try {
    openaiResult = await analyzeWithOpenAI(trimmed);
  } catch (e) {
    console.error("[analyze] runComplianceAnalysis: OpenAI threw:", e);
  }

  const raw = mergeRuleAndOpenAI(ruleResult, openaiResult);

  console.log("[analyze] runComplianceAnalysis", {
    inputLength: trimmed.length,
    analyzerOpenaiFindings: openaiResult?.findings.length ?? 0,
    analyzerRuleFindings: ruleResult.findings.length,
    findingsCount: raw.findings.length,
    source: raw.meta.source,
  });

  const normalized = normalizeAnalysisResult(raw, trimmed);
  return {
    ...normalized,
    meta: { ...normalized.meta, ...metaPatch },
  };
}
