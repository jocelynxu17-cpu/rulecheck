/**
 * OCR 字形校正後全文 → GPT 可讀性清理（不扣共用審查額度）。
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { cleanOcrTextWithOpenAI, type GptOcrCleanResult } from "@/lib/ocr/ocr-gpt-cleanup";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BODY = 16_384;

function errJson(message: string, code: string, status: number) {
  return NextResponse.json({ error: message, code }, { status });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return errJson("請先登入。", "UNAUTHORIZED", 401);
  }

  const ct = request.headers.get("content-type") ?? "";
  if (!ct.includes("application/json")) {
    return errJson("請使用 application/json。", "INVALID_CONTENT_TYPE", 400);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errJson("JSON 解析失敗。", "INVALID_JSON", 400);
  }

  const rec = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
  const text = typeof rec.text === "string" ? rec.text : "";
  if (text.length > MAX_BODY) {
    return errJson(`文字過長（上限 ${MAX_BODY} 字元）。`, "TEXT_TOO_LONG", 400);
  }

  console.info("[api/ocr/clean] deployment context:", {
    NODE_ENV: process.env.NODE_ENV ?? "(unset)",
    OPENAI_API_KEY_PRESENT: Boolean(process.env.OPENAI_API_KEY),
  });

  const rawResult = await cleanOcrTextWithOpenAI(text);
  const { _openAiCaughtError, ...result } = rawResult as GptOcrCleanResult & {
    _openAiCaughtError?: unknown;
  };

  if (_openAiCaughtError !== undefined) {
    console.error("[api/ocr/clean] OpenAI caught error (original):", _openAiCaughtError);
    if (_openAiCaughtError instanceof Error && _openAiCaughtError.stack) {
      console.error(_openAiCaughtError.stack);
    }
  }

  if (result.source === "fallback") {
    console.error("[api/ocr/clean] GPT clean fallback:", {
      code: result.code,
      debugMessage: result.debugMessage,
      labelZh: result.labelZh,
      NODE_ENV: process.env.NODE_ENV ?? "(unset)",
      OPENAI_API_KEY_PRESENT: Boolean(process.env.OPENAI_API_KEY),
    });
  }

  return NextResponse.json({
    textClean: result.textClean,
    source: result.source,
    code: result.code,
    labelZh: result.labelZh,
    debugMessage: result.debugMessage,
  });
}
