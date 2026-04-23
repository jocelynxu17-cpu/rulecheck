import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { IMAGE_MAX_BYTES, ocrImageBuffer } from "@/lib/content-extract/image-ocr";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * 僅擷取圖片文字（不扣共用審查額度），供編輯後再送交檢測。
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "請先登入。" }, { status: 401 });
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return NextResponse.json({ error: "請使用 multipart 上傳圖片。" }, { status: 400 });
  }

  const form = await request.formData();
  const f = form.get("file");
  if (!(f instanceof File)) {
    return NextResponse.json({ error: "請上傳圖片檔。" }, { status: 400 });
  }
  if (f.size > IMAGE_MAX_BYTES) {
    return NextResponse.json({ error: "圖片檔過大（上限 10MB）。" }, { status: 400 });
  }

  const buf = Buffer.from(await f.arrayBuffer());
  try {
    const ocr = await ocrImageBuffer(buf);
    console.log("[analyze] ocr-preview", { ocrTextLength: ocr.text.length, confidence: ocr.confidence, fileBytes: f.size });
    return NextResponse.json({
      text: ocr.text,
      confidence: ocr.confidence,
    });
  } catch (e) {
    console.error("[analyze] ocr-preview failure:", e);
    return NextResponse.json({ error: "圖片文字辨識失敗，請改用更清晰的圖檔。" }, { status: 422 });
  }
}
