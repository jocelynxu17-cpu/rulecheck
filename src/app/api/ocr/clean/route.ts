/**
 * OCR 字形校正後全文 → GPT 可讀性清理（不扣共用審查額度）。
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { cleanOcrTextWithOpenAI } from "@/lib/ocr/ocr-gpt-cleanup";

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

  const { textClean, source } = await cleanOcrTextWithOpenAI(text);

  return NextResponse.json({
    textClean,
    source,
    labelZh:
      source === "openai"
        ? "已套用 GPT 可讀性清理（空格、斷行與明顯雜訊；未新增行銷內容）。"
        : "未套用 GPT 清理（無金鑰或處理失敗），輸出與輸入相同。",
  });
}
