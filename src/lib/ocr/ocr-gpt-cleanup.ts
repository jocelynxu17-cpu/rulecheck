import OpenAI from "openai";
import { z } from "zod";
import type { GptOcrCleanCode, OcrDetailedResult, OcrGptCleanupMeta } from "@/lib/ocr/tesseract-page-result";
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

const CLEAN_TIMEOUT_MS = 55_000;

export type GptOcrCleanResult = {
  textClean: string;
  source: "openai" | "fallback";
  code: GptOcrCleanCode;
  labelZh: string;
  debugMessage: string;
  /** 僅於 OpenAI `catch` 填寫；`/api/ocr/clean` 回應 JSON 前必須刪除，勿送給前端 */
  _openAiCaughtError?: unknown;
};

function labelForCode(code: GptOcrCleanCode): string {
  switch (code) {
    case "GPT_CLEAN_OK":
      return "已套用 GPT 可讀性清理（空格、斷行與明顯雜訊；未新增行銷內容）。";
    case "GPT_CLEAN_NO_API_KEY":
      return "未設定 OPENAI_API_KEY，此程序未呼叫 OpenAI。";
    case "GPT_CLEAN_OPENAI_REQUEST_FAILED":
      return "OpenAI 請求失敗（非逾時、非鑑權錯誤），已回退為字形校正後原文。";
    case "GPT_CLEAN_TIMEOUT":
      return "OpenAI 請求逾時或連線中斷，已回退為字形校正後原文。";
    case "GPT_CLEAN_INVALID_RESPONSE":
      return "模型回應缺漏、JSON 無效或輸出未通過檢查，已回退為字形校正後原文。";
    case "GPT_CLEAN_AUTH_ERROR":
      return "OpenAI 鑑權失敗（例如 401／403），請檢查金鑰與專案權限。";
    case "GPT_CLEAN_UNKNOWN_ERROR":
      return "發生未分類錯誤，已回退為字形校正後原文。";
    default:
      return "處理失敗，已回退為字形校正後原文。";
  }
}

function okResult(textClean: string): GptOcrCleanResult {
  return {
    textClean,
    source: "openai",
    code: "GPT_CLEAN_OK",
    labelZh: labelForCode("GPT_CLEAN_OK"),
    debugMessage: "OpenAI response accepted.",
  };
}

function fallbackResult(
  textClean: string,
  code: GptOcrCleanCode,
  debugMessage: string,
  err?: unknown
): GptOcrCleanResult {
  if (err !== undefined) {
    console.error("[ocr-gpt-cleanup] fallback", code, debugMessage, err);
    if (err instanceof Error && err.stack) {
      console.error(err.stack);
    }
  } else {
    console.error("[ocr-gpt-cleanup] fallback", code, debugMessage);
  }
  return {
    textClean,
    source: "fallback",
    code,
    labelZh: labelForCode(code),
    debugMessage: debugMessage.slice(0, 800),
  };
}

function isAbortError(e: unknown): boolean {
  if (!(e instanceof Error)) return false;
  if (e.name === "AbortError") return true;
  if (e.message === "This operation was aborted") return true;
  return /aborted|timeout|ETIMEDOUT|ECONNABORTED/i.test(e.message);
}

function classifyOpenAiError(e: unknown): { code: GptOcrCleanCode; debugMessage: string } {
  if (isAbortError(e)) {
    const msg = e instanceof Error ? e.message : String(e);
    return { code: "GPT_CLEAN_TIMEOUT", debugMessage: msg.slice(0, 500) };
  }

  if (e instanceof OpenAI.APIError) {
    const status = e.status;
    if (status === 401 || status === 403) {
      return {
        code: "GPT_CLEAN_AUTH_ERROR",
        debugMessage: `OpenAI APIError status=${status}: ${e.message}`.slice(0, 500),
      };
    }
    return {
      code: "GPT_CLEAN_OPENAI_REQUEST_FAILED",
      debugMessage: `OpenAI APIError status=${status ?? "?"}: ${e.message}`.slice(0, 500),
    };
  }

  if (typeof e === "object" && e !== null && "status" in e) {
    const st = Number((e as { status: unknown }).status);
    if (st === 401 || st === 403) {
      const msg = e instanceof Error ? e.message : JSON.stringify(e).slice(0, 400);
      return { code: "GPT_CLEAN_AUTH_ERROR", debugMessage: msg.slice(0, 500) };
    }
  }

  if (e instanceof Error) {
    return {
      code: "GPT_CLEAN_OPENAI_REQUEST_FAILED",
      debugMessage: `${e.name}: ${e.message}`.slice(0, 500),
    };
  }

  return {
    code: "GPT_CLEAN_UNKNOWN_ERROR",
    debugMessage: String(e).slice(0, 500),
  };
}

/**
 * 以 GPT 將「字形校正後」OCR 全文整理為較可讀版本；失敗時回傳 fallback（輸入原文）並附帶 `code`／`debugMessage`。
 */
export async function cleanOcrTextWithOpenAI(normalizedText: string): Promise<GptOcrCleanResult> {
  const input = normalizedText.trim();
  if (!input) {
    return fallbackResult(
      "",
      "GPT_CLEAN_INVALID_RESPONSE",
      "Input text was empty after trim; no OpenAI call."
    );
  }

  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    return fallbackResult(input, "GPT_CLEAN_NO_API_KEY", "OPENAI_API_KEY is not set in this process environment.");
  }

  const sliced = input.length > MAX_IN ? `${input.slice(0, MAX_IN)}\n…（以下略，已截斷）` : input;
  const model = process.env.OPENAI_OCR_CLEAN_MODEL ?? process.env.OPENAI_MODEL ?? "gpt-4o-mini";

  let signal: AbortSignal | undefined;
  try {
    signal = AbortSignal.timeout(CLEAN_TIMEOUT_MS);
  } catch {
    signal = undefined;
  }

  try {
    const openai = new OpenAI({ apiKey: key });
    const completion = await openai.chat.completions.create(
      {
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
      },
      signal ? { signal } : undefined
    );

    const raw = completion.choices[0]?.message?.content;
    if (!raw) {
      return fallbackResult(
        input,
        "GPT_CLEAN_INVALID_RESPONSE",
        "OpenAI returned empty message content (choices[0].message.content)."
      );
    }

    let parsed: z.infer<typeof CleanedSchema>;
    try {
      parsed = CleanedSchema.parse(JSON.parse(raw));
    } catch (parseErr) {
      return fallbackResult(
        input,
        "GPT_CLEAN_INVALID_RESPONSE",
        `JSON parse or schema failed: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`,
        parseErr
      );
    }

    const cleaned = parsed.cleaned.trim();
    if (!cleaned) {
      return fallbackResult(
        input,
        "GPT_CLEAN_INVALID_RESPONSE",
        "Model returned empty or whitespace-only cleaned string."
      );
    }

    if (input.length > 80 && cleaned.length < input.length * 0.45) {
      return fallbackResult(
        input,
        "GPT_CLEAN_INVALID_RESPONSE",
        `Heuristic reject: cleaned length ${cleaned.length} < 45% of input length ${input.length} (possible hallucination or over-deletion).`
      );
    }
    if (cleaned.length > input.length * 1.35 + 120) {
      return fallbackResult(
        input,
        "GPT_CLEAN_INVALID_RESPONSE",
        `Heuristic reject: cleaned length ${cleaned.length} exceeds input length ${input.length} by too large a margin.`
      );
    }

    return okResult(cleaned);
  } catch (e) {
    const { code, debugMessage } = classifyOpenAiError(e);
    return {
      ...fallbackResult(input, code, debugMessage, e),
      _openAiCaughtError: e,
    };
  }
}

function resultToGptMeta(r: GptOcrCleanResult): OcrGptCleanupMeta {
  return {
    source: r.source,
    labelZh: r.labelZh,
    code: r.code,
    debugMessage: r.debugMessage,
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
      gptCleanup: resultToGptMeta(
        fallbackResult("", "GPT_CLEAN_INVALID_RESPONSE", "Base text empty after trim; skipped GPT clean.")
      ),
    };
  }

  const result = await cleanOcrTextWithOpenAI(base);
  const conf = detailed.confidence;
  const { lines, blocks } = rebuildOcrLinePreviewsFromFullText(result.textClean, conf, 420);

  return {
    ...detailed,
    textClean: result.textClean,
    lines,
    blocks,
    gptCleanup: resultToGptMeta(result),
  };
}
