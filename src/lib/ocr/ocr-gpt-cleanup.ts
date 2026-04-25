import OpenAI from "openai";
import { z } from "zod";
import type { OcrDetailedResult, OcrGptCleanupMeta } from "@/lib/ocr/tesseract-page-result";
import { rebuildOcrLinePreviewsFromFullText } from "@/lib/ocr/ocr-line-rebuild";

const CleanedSchema = z.object({
  cleaned: z.string(),
});

const OCR_CLEAN_SYSTEM = `你是 OCR 後段「可讀性清理」助理。使用者會提供一段**已做完繁／簡字形正規化**的文字（來自圖片 OCR），請只做**版面與雜訊整理**，讓人類更容易閱讀。

【必須遵守】
1. **不得捏造內容**：不可新增產品名、療效、行銷語、數字優惠、警語或任何原文沒有的主張。
2. **意義不變**：只修正空格、斷行、被拆斷的詞組、明顯的 OCR 雜訊符號（如孤立 | \\ / 重複標點）；語意上拿不準時**原字保留**。
3. **不再轉換繁簡**：輸入已是目標字形風格，請勿再做繁簡轉換或替換同義字。
4. **保守改寫**：能少改就少改；寧可保留怪字也不要猜測替換成新詞。
5. **輸入**：下則 user 訊息為 JSON，請讀取其中 \`ocrText\` 欄位作為待清理全文。
6. **輸出**：僅輸出單一 JSON 物件 {"cleaned": "..."}，不要 markdown；cleaned 為清理後的**完整**文字，可含換行。`;

const MAX_IN = 14_000;

/**
 * 以 GPT 將「字形校正後」OCR 全文整理為較可讀版本；無金鑰或失敗時回傳 fallback（輸入原文）。
 */
export async function cleanOcrTextWithOpenAI(normalizedText: string): Promise<{
  textClean: string;
  source: "openai" | "fallback";
}> {
  const input = normalizedText.trim();
  if (!input) {
    return { textClean: "", source: "fallback" };
  }

  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    return { textClean: input, source: "fallback" };
  }

  const sliced = input.length > MAX_IN ? `${input.slice(0, MAX_IN)}\n…（以下略，已截斷）` : input;
  const model = process.env.OPENAI_OCR_CLEAN_MODEL ?? process.env.OPENAI_MODEL ?? "gpt-4o-mini";

  try {
    const openai = new OpenAI({ apiKey: key });
    const completion = await openai.chat.completions.create({
      model,
      temperature: 0.1,
      max_tokens: Math.min(8192, Math.max(1024, Math.ceil(sliced.length * 1.2) + 400)),
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: OCR_CLEAN_SYSTEM },
        {
          role: "user",
          content: JSON.stringify({ ocrText: sliced }),
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) {
      return { textClean: input, source: "fallback" };
    }

    let parsed: z.infer<typeof CleanedSchema>;
    try {
      parsed = CleanedSchema.parse(JSON.parse(raw));
    } catch {
      return { textClean: input, source: "fallback" };
    }

    const cleaned = parsed.cleaned.trim();
    if (!cleaned) {
      return { textClean: input, source: "fallback" };
    }

    /** 明顯刪除過多或擴寫過多（防幻覺／跑題），退回字形校正層 */
    if (input.length > 80 && cleaned.length < input.length * 0.45) {
      return { textClean: input, source: "fallback" };
    }
    if (cleaned.length > input.length * 1.35 + 120) {
      return { textClean: input, source: "fallback" };
    }

    return { textClean: cleaned, source: "openai" };
  } catch (e) {
    console.error("[ocr-gpt-cleanup] OpenAI call failed:", e);
    return { textClean: input, source: "fallback" };
  }
}

function buildGptCleanupMeta(source: "openai" | "fallback"): OcrGptCleanupMeta {
  if (source === "openai") {
    return {
      source,
      labelZh: "已套用 GPT 可讀性清理（空格、斷行與明顯雜訊；未新增行銷內容）。",
    };
  }
  return {
    source,
    labelZh: "未套用 GPT 清理（無 API 金鑰、逾時或解析失敗），以下欄位與字形校正後一致。",
  };
}

/**
 * 在已有 `text`／`textDisplay`／行區塊之結果上，產生 `textClean` 並以清理後全文重建行／區塊（供 UI 一致）。
 */
export async function enrichOcrWithGptCleanup(detailed: OcrDetailedResult): Promise<OcrDetailedResult> {
  const base = (detailed.textDisplay ?? detailed.text).trim();
  if (!base) {
    return {
      ...detailed,
      textClean: "",
      gptCleanup: buildGptCleanupMeta("fallback"),
    };
  }

  const { textClean, source } = await cleanOcrTextWithOpenAI(base);
  const conf = detailed.confidence;
  const { lines, blocks } = rebuildOcrLinePreviewsFromFullText(textClean, conf, 420);

  return {
    ...detailed,
    textClean,
    lines,
    blocks,
    gptCleanup: buildGptCleanupMeta(source),
  };
}
