import OpenAI from "openai";
import { z } from "zod";
import type { AnalysisFinding, AnalysisResult } from "@/types/analysis";
import { mergeFindingsSpans } from "@/lib/text-spans";

const RewriteSchema = z.object({
  conservative: z.string(),
  marketing_natural: z.string(),
  ecommerce_concise: z.string(),
});

const FindingSchema = z.object({
  riskyPhrase: z.string(),
  matchedText: z.string().optional(),
  category: z.enum(["醫療效能", "誇大", "誤導", "其他"]),
  riskType: z.string(),
  severity: z.enum(["high", "medium", "low"]),
  lawName: z.string(),
  article: z.string(),
  reason: z.string(),
  legalReference: z.string(),
  suggestion: z.string(),
  rewrites: RewriteSchema,
});

const ResponseSchema = z.object({
  summary: z.string(),
  findings: z.array(FindingSchema),
});

export async function analyzeWithOpenAI(text: string): Promise<AnalysisResult | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;

  const openai = new OpenAI({ apiKey: key });

  const system = `你是台灣化粧品與食品「廣告合規」顧問助理。請以繁體中文輸出 JSON（不要 markdown）。
每一筆 finding 必須包含：
- lawName：法規名稱（例如：公平交易法、食品安全衛生管理法、化粧品衛生安全管理法等）
- article：條號／項次（例如：第21條；若無法精準對應請寫「相關條文」並仍保持保守）
- reason：一句話、可給行銷看的「為何可能構成風險」
- category：醫療效能 / 誇大 / 誤導 / 其他
- legalReference：2~3 句補充脈絡（仍須聲明為示意，非律師見解）
- rewrites：必須輸出三個欄位（字串）：
  - conservative：保守安全版（最克制、最少承諾）
  - marketing_natural：行銷自然版（可讀性高但仍避免療效暗示）
  - ecommerce_concise：電商簡潔版（短句、適合主圖/副標附近，仍避免誇大）
嚴重度 high/medium/low。
僅輸出 JSON。`;

  const user = `文案：\n"""${text.slice(0, 24_000)}"""`;

  const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) return null;

  let parsed: z.infer<typeof ResponseSchema>;
  try {
    parsed = ResponseSchema.parse(JSON.parse(raw));
  } catch {
    return null;
  }

  const findings: AnalysisFinding[] = parsed.findings.map((f) => {
    const matchedText = (f.matchedText?.trim() || f.riskyPhrase).trim();
    return {
      riskyPhrase: f.riskyPhrase,
      matchedText,
      spans: mergeFindingsSpans(text, matchedText, f.riskyPhrase),
      category: f.category,
      riskType: f.riskType,
      severity: f.severity,
      lawName: f.lawName,
      article: f.article,
      reason: f.reason,
      legalReference: f.legalReference,
      suggestion: f.suggestion,
      rewrites: {
        conservative: f.rewrites.conservative,
        marketing: f.rewrites.marketing_natural,
        ecommerce: f.rewrites.ecommerce_concise,
      },
    };
  });

  return {
    findings,
    summary: parsed.summary,
    scannedAt: new Date().toISOString(),
    meta: {
      source: "openai",
      guest: false,
      quotaRemaining: null,
    },
  };
}
