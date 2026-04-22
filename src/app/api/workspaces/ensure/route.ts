import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureUserWorkspace } from "@/lib/workspace/ensure-workspace";

/** Explicit repair: re-run ensure (e.g. after transient DB error). */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "請先登入。" }, { status: 401 });

  const result = await ensureUserWorkspace(supabase);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 503 });
  }
  return NextResponse.json({ ok: true, created: result.created, workspaceId: result.workspaceId ?? null });
}
