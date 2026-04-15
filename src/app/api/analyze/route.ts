import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { analyzeTextMock } from "@/lib/analyzer-mock";
import { analyzeWithOpenAI } from "@/lib/analyzer-openai";
import type { AnalysisResult } from "@/types/analysis";
import { GUEST_ANALYSIS_COOKIE } from "@/lib/constants";
import { normalizeAnalysisResult } from "@/lib/analysis-normalize";

type ConsumePayload = {
  ok?: boolean;
  remaining?: number;
  quota?: number;
  error?: string;
};

function guestCookieOptions() {
  return {
    httpOnly: true as const,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    secure: process.env.NODE_ENV === "production",
  };
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "無效的 JSON。" }, { status: 400 });
  }

  const text =
    typeof body === "object" && body !== null && "text" in body
      ? String((body as { text: unknown }).text)
      : "";

  if (!text.trim()) {
    return NextResponse.json({ error: "請提供要檢測的文案（text）。" }, { status: 400 });
  }

  const cookieStore = await cookies();

  if (!user) {
    if (cookieStore.get(GUEST_ANALYSIS_COOKIE)?.value === "1") {
      return NextResponse.json(
        { error: "訪客免費次數已使用完畢，請註冊或登入以繼續檢測。" },
        { status: 403 }
      );
    }
  }

  let quotaRemaining: number | null = null;
  let plan: string | null = null;

  if (user) {
    const { data: rpcData, error: rpcError } = await supabase.rpc("consume_analysis_credit", {
      p_user_id: user.id,
    });

    if (rpcError) {
      console.error("consume_analysis_credit:", rpcError.message);
    } else {
      const row = rpcData as ConsumePayload | null;
      if (row && row.ok === false) {
        if (row.error === "quota_exceeded") {
          return NextResponse.json(
            { error: "本月分析配額已用完，請升級方案或次月再試。" },
            { status: 429 }
          );
        }
        return NextResponse.json(
          { error: "無法確認配額狀態，請確認資料庫已套用最新 migration。" },
          { status: 503 }
        );
      }
      if (row && row.ok) {
        quotaRemaining = typeof row.remaining === "number" ? row.remaining : null;
      }
    }

    const { data: profile } = await supabase
      .from("users")
      .select("plan")
      .eq("id", user.id)
      .maybeSingle();
    plan = profile?.plan ?? null;
  }

  let result: AnalysisResult;
  try {
    const ai = await analyzeWithOpenAI(text);
    result = ai ?? analyzeTextMock(text);
  } catch (e) {
    console.error("analyze:", e);
    result = analyzeTextMock(text);
  }

  result.meta = {
    source: result.meta.source,
    guest: !user,
    quotaRemaining: user ? quotaRemaining : null,
    plan: user ? plan : null,
  };

  const normalized = normalizeAnalysisResult(result, text);

  if (user) {
    const { error: logError } = await supabase.from("analysis_logs").insert({
      user_id: user.id,
      input_text: text.slice(0, 50_000),
      result: normalized as unknown as Record<string, unknown>,
    });
    if (logError) console.error("analysis_logs insert:", logError.message);
  }

  const res = NextResponse.json(normalized);

  if (!user) {
    res.cookies.set(GUEST_ANALYSIS_COOKIE, "1", guestCookieOptions());
  }

  return res;
}
