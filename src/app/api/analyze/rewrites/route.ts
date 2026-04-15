import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { AnalysisFinding, AnalysisRewrites } from "@/types/analysis";
import { normalizeFinding } from "@/lib/analysis-normalize";
import { regenerateRewritesFallback, regenerateRewritesWithOpenAI } from "@/lib/regenerate-rewrites";

type Body = {
  fullText?: unknown;
  finding?: unknown;
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "請先登入以重新產生改寫。" }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "無效的 JSON。" }, { status: 400 });
  }

  const fullText = typeof body.fullText === "string" ? body.fullText : "";
  if (!fullText.trim()) {
    return NextResponse.json({ error: "缺少全文內容。" }, { status: 400 });
  }

  const finding = normalizeFinding(body.finding, fullText);

  let rewrites: AnalysisRewrites | null = null;
  try {
    rewrites = await regenerateRewritesWithOpenAI({
      fullText,
      finding: {
        riskyPhrase: finding.riskyPhrase,
        matchedText: finding.matchedText,
        category: finding.category,
        lawName: finding.lawName,
        article: finding.article,
        reason: finding.reason,
        riskType: finding.riskType,
      },
    });
  } catch (e) {
    console.error("regenerateRewrites:", e);
  }

  if (!rewrites) {
    rewrites = regenerateRewritesFallback(finding);
  }

  return NextResponse.json({ rewrites });
}
