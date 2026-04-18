import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  const { workspaceId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "請先登入。" }, { status: 401 });

  let body: { name?: string; monthlyQuotaUnits?: number };
  try {
    body = (await request.json()) as { name?: string; monthlyQuotaUnits?: number };
  } catch {
    return NextResponse.json({ error: "無效的 JSON。" }, { status: 400 });
  }

  const { data: mem } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!mem || (mem.role !== "owner" && mem.role !== "admin")) {
    return NextResponse.json({ error: "需要管理員權限。" }, { status: 403 });
  }

  const patch: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim()) patch.name = body.name.trim();
  if (typeof body.monthlyQuotaUnits === "number" && body.monthlyQuotaUnits >= 100 && body.monthlyQuotaUnits <= 10_000_000) {
    patch.monthly_quota_units = Math.floor(body.monthlyQuotaUnits);
  }

  if (!Object.keys(patch).length) {
    return NextResponse.json({ error: "沒有有效欄位。" }, { status: 400 });
  }

  const { data, error } = await supabase.from("workspaces").update(patch).eq("id", workspaceId).select().maybeSingle();

  if (error) {
    console.error("workspace patch:", error.message);
    return NextResponse.json({ error: "更新失敗。" }, { status: 500 });
  }

  return NextResponse.json({ workspace: data });
}
