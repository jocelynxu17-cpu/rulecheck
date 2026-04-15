import OpenAI from "openai";
import { z } from "zod";
import type { AnalysisFinding, AnalysisRewrites } from "@/types/analysis";

const OutSchema = z.object({
  conservative: z.string(),
  marketing_natural: z.string(),
  ecommerce_concise: z.string(),
});

export async function regenerateRewritesWithOpenAI(input: {
  fullText: string;
  finding: Pick<
    AnalysisFinding,
    "riskyPhrase" | "matchedText" | "category" | "lawName" | "article" | "reason" | "riskType"
  >;
}): Promise<AnalysisRewrites | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;

  const openai = new OpenAI({ apiKey: key });
  const system = `你是台灣化粧品/食品廣告合規改寫助理。輸出 JSON（不要 markdown）。
必須輸出三個欄位：
- conservative：保守安全版
- marketing_natural：行銷自然版
- ecommerce_concise：電商簡潔版
內容需繁體中文、避免醫療效能暗示、避免誇大保證。`;

  const user = `全文：\n"""${input.fullText.slice(0, 24_000)}"""\n\n風險片段：${input.finding.matchedText || input.finding.riskyPhrase}\n類別：${input.finding.category}\n法規：${input.finding.lawName} ${input.finding.article}\n原因：${input.finding.reason}\n風險類型：${input.finding.riskType}\n\n請重新產出三版改寫（與先前版本用字盡量不同）。`;

  const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    temperature: 0.55,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) return null;
  try {
    const parsed = OutSchema.parse(JSON.parse(raw));
    return {
      conservative: parsed.conservative,
      marketing: parsed.marketing_natural,
      ecommerce: parsed.ecommerce_concise,
    };
  } catch {
    return null;
  }
}

export function regenerateRewritesFallback(finding: AnalysisFinding): AnalysisRewrites {
  const base = `${finding.category}風險語氣下，避免承諾療效與誇大。`;
  return {
    conservative: `${base} 建議改為更中性、可驗證之描述，並保留法遵覆核空間。`,
    marketing: `${base} 以生活情境與使用感受切入，避免連結疾病或療效。`,
    ecommerce: `${base} 以短句呈現重點，避免「保證／治療／消炎」等高風險詞。`,
  };
}
