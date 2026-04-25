/**
 * 伺服器端 OCR 預覽（除錯／後援）。
 * 正式產品流程請使用瀏覽器端 Tesseract（Analyze 頁「擷取文字」），以避免 Vercel serverless 逾時。
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { IMAGE_MAX_BYTES } from "@/lib/analyze/input-limits";
import { ocrImageBufferDetailed } from "@/lib/content-extract/image-ocr";

export const runtime = "nodejs";
export const maxDuration = 60;

function errJson(message: string, code: string, status: number, details?: Record<string, unknown>) {
  return NextResponse.json(
    { error: message, code, ...(details ? { details } : {}) },
    { status }
  );
}

/**
 * 僅擷取圖片文字（不扣共用審查額度），供編輯後再送交檢測。
 * 回傳整頁信心（由有文字之行的 Tesseract 行信心平均）及可選的區塊／行結構。
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return errJson("請先登入。", "UNAUTHORIZED", 401);
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return errJson("請使用 multipart 上傳圖片。", "INVALID_CONTENT_TYPE", 400);
  }

  const form = await request.formData();
  const f = form.get("file");
  if (!(f instanceof File)) {
    return errJson("請上傳圖片檔。", "NO_FILE", 400);
  }
  if (f.size > IMAGE_MAX_BYTES) {
    return errJson("圖片檔過大（上限 10MB）。", "FILE_TOO_LARGE", 400);
  }

  const buf = Buffer.from(await f.arrayBuffer());
  try {
    const ocr = await ocrImageBufferDetailed(buf);

    const linesOut = ocr.lines.slice(0, 60).map((l) => ({
      text: l.text.length > 240 ? `${l.text.slice(0, 240)}…` : l.text,
      confidence: l.confidence,
      confidencePercent: Math.round(l.confidence * 100),
    }));

    const blocksOut = ocr.blocks.slice(0, 24).map((b) => ({
      text: b.text.length > 400 ? `${b.text.slice(0, 400)}…` : b.text,
      confidence: b.confidence,
      confidencePercent: Math.round(b.confidence * 100),
      lineCount: b.lines.length,
      lines: b.lines.slice(0, 12).map((l) => ({
        text: l.text.length > 200 ? `${l.text.slice(0, 200)}…` : l.text,
        confidence: l.confidence,
        confidencePercent: Math.round(l.confidence * 100),
      })),
    }));

    console.log("[analyze] ocr-preview", {
      ocrTextLength: ocr.text.length,
      confidence: ocr.confidence,
      confidencePercent: ocr.confidencePercent,
      lineCount: ocr.lines.length,
      blockCount: ocr.blocks.length,
      fileBytes: f.size,
    });

    return NextResponse.json({
      text: ocr.text,
      textDisplay: ocr.textDisplay ?? ocr.text,
      textClean: ocr.textClean ?? ocr.textDisplay ?? ocr.text,
      displayNormalization: ocr.displayNormalization ?? null,
      gptCleanup: ocr.gptCleanup ?? null,
      confidence: ocr.confidence,
      confidencePercent: ocr.confidencePercent,
      lines: linesOut,
      blocks: blocksOut,
    });
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    console.error("[analyze] ocr-preview failure:", err.message, err.stack);
    return errJson("圖片文字辨識失敗，請改用更清晰的圖檔。", "OCR_FAILED", 422, {
      message: err.message,
      stack: err.stack?.slice(0, 1200),
    });
  }
}
