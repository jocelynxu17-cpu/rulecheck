import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureUserWorkspace } from "@/lib/workspace/ensure-workspace";

function supabaseLikeDebugPayload(e: unknown): Record<string, unknown> | undefined {
  if (!e || typeof e !== "object") return undefined;
  const o = e as Record<string, unknown>;
  if (typeof o.message !== "string") return undefined;
  if (!("code" in o) && !("details" in o) && !("hint" in o)) return undefined;
  const out: Record<string, unknown> = { message: o.message };
  if ("code" in o) out.code = o.code;
  if ("details" in o) out.details = o.details;
  if ("hint" in o) out.hint = o.hint;
  return out;
}

export async function GET() {
  try {
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
      console.error("workspaces list:", error);
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
  } catch (e) {
    console.error("[GET /api/workspaces] unhandled error:", e);

    const safeMessage = "無法載入工作區。";
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: safeMessage }, { status: 500 });
    }

    const err = e instanceof Error ? e : new Error(String(e));
    const supabaseDetails = supabaseLikeDebugPayload(e) ?? (e instanceof Error ? supabaseLikeDebugPayload(err.cause) : undefined);

    return NextResponse.json(
      {
        error: safeMessage,
        debug: {
          message: err.message,
          stack: err.stack ?? null,
          supabase: supabaseDetails ?? null,
        },
      },
      { status: 500 }
    );
  }
}
