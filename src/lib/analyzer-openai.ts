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

  const system = `你是台灣「廣告合規」顧問助理，專長為化粧品、食品、一般消費性商品之行銷文案。請以繁體中文輸出單一 JSON 物件（不要 markdown、不要程式碼區塊）。

【推理方式（必遵守）】
1. 先閱讀全文，推斷：文案所描述的商品或服務類型、溝通場景（例如：美妝保養、瘦身食品、營養補充、家清、課程服務等），以及最可能牽涉之法規族系（例如：公平交易法之「引人錯誤／虛偽不實／誇大」、食品安全衛生管理法對食品宣稱、化粧品衛生安全管理法對標示與廣告等）。你不得只靠比對少數「禁字表」；必須從「宣稱內容在對消費者傳達什麼」來思考。
2. 將有疑慮之處以「句子或子句級」的宣稱（claim）為單位標出，而非只圈單一詞彙。若某風險來自整句語意，matchedText 應盡量涵蓋該句或關鍵子句（必要時可為連續片語，但避免只給兩三個字）。
3. 每一筆 finding 必須對應下列「法律風險維度」之一，並把該維度寫進 riskType 字串的開頭，格式嚴格為：
   riskType = "【維度名稱】" + 接續說明為何此宣稱在該維度下可能有合規疑慮（1～2 句）。
   維度名稱僅能擇一使用（字串須完全一致）：
   - 醫療療效暗示
   - 誇大效果
   - 絕對化/保證性表述
   - 速效或數字結果承諾
   - 容易誤導的效果描述
4. category 欄位（四選一）請與維度合理對應，供系統分類用：
   - 醫療療效暗示 → 通常填「醫療效能」
   - 誇大效果、絕對化/保證性表述、速效或數字結果承諾 → 通常填「誇大」
   - 容易誤導的效果描述 → 通常填「誤導」
   - 若難以歸類則「其他」
5. riskyPhrase：請用簡短中文標題描述「該宣稱在承諾什麼」（例如「為期程與體重變化之結果承諾」），不要只複製一個孤立的「敏感詞」。
6. reason：請寫清楚 (a) 你認為該句對消費者傳達了什麼效果或機制主張；(b) 在一般法規實務下，為何該主張可能產生風險（連結到法規意旨，而非「因為出現某字」）。
7. suggestion 與 rewrites：須具體示範如何改寫或刪除過度承諾，使語意較不易被認定為誇大、誤導或醫療暗示；三種語氣須為完整字串。

【輸出欄位（每筆 finding）】
- lawName、article、reason、category、legalReference、severity（high/medium/low）
- legalReference：2～3 句補充脈絡，並聲明為法規意旨之示意整理，非律師意見或函釋。
- rewrites 三鍵名稱固定為：conservative、marketing_natural、ecommerce_concise（字串）。

【summary】
第一段 1～2 句：簡述你對「內容／產業類型」與「主要可能適用法規族系」之判斷（仍須聲明為示意）。
其後：概括今日 findings 與整體風險程度。

僅輸出符合 schema 的 JSON。`;

  const user = `以下為待檢視文案（請依上文方法分析，不要只做關鍵字比對）：\n"""${text.slice(0, 24_000)}"""`;

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
  if (!raw) {
    console.error("[analyze] OpenAI returned empty message content");
    return null;
  }

  let parsed: z.infer<typeof ResponseSchema>;
  try {
    parsed = ResponseSchema.parse(JSON.parse(raw));
  } catch (e) {
    console.error("[analyze] OpenAI JSON parse/schema failed:", e);
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

const VISION_SYSTEM = `你是台灣「廣告合規」顧問助理。你會收到一張**廣告／海報／電商素材**圖片（可能含主標、副標、產品圖、數字、Logo、警語等）。
請**以畫面整體為主**判斷主要行銷宣稱與合規風險；不要假設你一定讀到所有小字。
若一併提供「OCR 參考文字」，僅供對照可能漏讀之處，**仍以圖面視覺訊息為準**。

輸出單一 JSON 物件（不要 markdown），schema 與純文字版相同：
{ "summary": string, "findings": array }

每筆 finding：
- riskType 開頭須為「【醫療療效暗示】|【誇大效果】|【絕對化/保證性表述】|【速效或數字結果承諾】|【容易誤導的效果描述】」之一，後接 1～2 句說明。
- matchedText：寫圖上可見的關鍵字句或主張（可引用 OCR 若與畫面一致）。
- riskyPhrase：簡短中文標題，描述「畫面在承諾什麼」。
- category、lawName、article、reason、legalReference、severity、rewrites（conservative / marketing_natural / ecommerce_concise）同文字版規範。

summary：第一段 1～2 句說明你從**圖像**推斷的產業／訴求與主要法規風險面向；其後概括 findings。`;

/**
 * 以 GPT **vision** 分析圖像本身（主軌）；與 OCR 文字軌分開。
 * `spanTargetText` 通常為 OCR 全文，用於在可對應時計算高亮 spans。
 */
export async function analyzeImageWithOpenAIVision(params: {
  imageBase64: string;
  mimeType: string;
  ocrHint: string;
  spanTargetText: string;
}): Promise<AnalysisResult | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;

  const model = process.env.OPENAI_VISION_MODEL ?? process.env.OPENAI_MODEL ?? "gpt-4o-mini";
  const openai = new OpenAI({ apiKey: key });
  const { imageBase64, mimeType, ocrHint, spanTargetText } = params;
  const hint = ocrHint.trim()
    ? `以下為使用者裝置 OCR 參考（可能不完整或錯誤，請以圖為準）：\n"""${ocrHint.slice(0, 12_000)}"""`
    : "（未提供 OCR 參考文字；請完全依圖面判讀。）";

  const completion = await openai.chat.completions.create({
    model,
    temperature: 0.2,
    max_tokens: 4096,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: VISION_SYSTEM },
      {
        role: "user",
        content: [
          { type: "text", text: hint },
          {
            type: "image_url",
            image_url: {
              url: `data:${mimeType};base64,${imageBase64}`,
              detail: "auto",
            },
          },
        ],
      },
    ],
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) {
    console.error("[analyze] OpenAI vision returned empty message content");
    return null;
  }

  let parsed: z.infer<typeof ResponseSchema>;
  try {
    parsed = ResponseSchema.parse(JSON.parse(raw));
  } catch (e) {
    console.error("[analyze] OpenAI vision JSON parse/schema failed:", e);
    return null;
  }

  const spanText = spanTargetText.trim() || " ";

  const findings: AnalysisFinding[] = parsed.findings.map((f) => {
    const matchedText = (f.matchedText?.trim() || f.riskyPhrase).trim();
    return {
      riskyPhrase: f.riskyPhrase,
      matchedText,
      spans: mergeFindingsSpans(spanText, matchedText, f.riskyPhrase),
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
