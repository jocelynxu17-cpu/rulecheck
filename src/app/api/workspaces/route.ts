import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureUserWorkspace } from "@/lib/workspace/ensure-workspace";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "請先登入。" }, { status: 401 });

  let ensureError: string | null = null;
  const ensured = await ensureUserWorkspace(supabase);
  if (!ensured.ok) {
    console.error("ensure_user_workspace:", ensured.error);
    ensureError = "無法建立或還原工作區，請稍後重試或聯絡管理員。";
  }

  const { data: rows, error } = await supabase
    .from("workspace_members")
    .select(
      `
      role,
      workspaces (
        id,
        name,
        plan,
        subscription_status,
        monthly_quota_units,
        units_used_month,
        usage_month
      )
    `
    )
    .eq("user_id", user.id);

  if (error) {
    console.error("workspaces list:", error.message);
    return NextResponse.json({ error: "無法載入工作區。" }, { status: 500 });
  }

  const workspaces = (rows ?? [])
    .map((r) => {
      const w = r.workspaces as unknown as {
        id: string;
        name: string;
        plan: string | null;
        subscription_status: string | null;
        monthly_quota_units: number;
        units_used_month: number;
        usage_month: string;
      } | null;
      if (!w) return null;
      return {
        id: w.id,
        name: w.name,
        role: r.role,
        plan: w.plan ?? "free",
        subscriptionStatus: w.subscription_status,
        monthlyQuotaUnits: w.monthly_quota_units,
        unitsUsedMonth: w.units_used_month,
        usageMonth: w.usage_month,
      };
    })
    .filter(Boolean);

  return NextResponse.json({ workspaces, ensureError, viewerUserId: user.id });
}
