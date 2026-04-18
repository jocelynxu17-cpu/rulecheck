import { analyzeWithOpenAI } from "@/lib/analyzer-openai";
import { analyzeTextMock } from "@/lib/analyzer-mock";
import { normalizeAnalysisResult } from "@/lib/analysis-normalize";
import type { AnalysisMeta, AnalysisResult } from "@/types/analysis";

export async function runComplianceAnalysis(
  text: string,
  metaPatch: Partial<AnalysisMeta>
): Promise<AnalysisResult> {
  let raw: AnalysisResult;
  try {
    raw = (await analyzeWithOpenAI(text)) ?? analyzeTextMock(text);
  } catch (e) {
    console.error("runComplianceAnalysis:", e);
    raw = analyzeTextMock(text);
  }
  const normalized = normalizeAnalysisResult(raw, text);
  return {
    ...normalized,
    meta: { ...normalized.meta, ...metaPatch },
  };
}
