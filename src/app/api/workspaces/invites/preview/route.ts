import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Public preview for join page (token-bound). Does not require login.
 * Uses service role server-side only; never returns raw token.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token")?.trim() ?? "";

  if (!token || token.length < 8) {
    return NextResponse.json({ error: "缺少或無效的邀請參數。" }, { status: 400 });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "預覽功能未設定。" }, { status: 503 });
  }

  try {
    const admin = createAdminClient();
    const { data: inv, error } = await admin
      .from("workspace_invites")
      .select("id, email, role, expires_at, accepted_at, revoked_at, workspace_id, workspaces ( name, plan )")
      .eq("token", token)
      .maybeSingle();

    if (error || !inv) {
      return NextResponse.json({ error: "邀請不存在。" }, { status: 404 });
    }

    const rawWs = inv.workspaces as unknown as { name: string; plan: string } | { name: string; plan: string }[] | null;
    const ws = Array.isArray(rawWs) ? rawWs[0] : rawWs;
    const workspaceName = ws?.name ?? "工作區";
    const plan = ws?.plan ?? "free";

    let status: "pending" | "expired" | "revoked" | "accepted" = "pending";
    if (inv.accepted_at) status = "accepted";
    else if (inv.revoked_at) status = "revoked";
    else if (new Date(inv.expires_at) < new Date()) status = "expired";

    return NextResponse.json({
      workspaceName,
      plan,
      inviteRole: inv.role,
      inviteEmail: inv.email,
      expiresAt: inv.expires_at,
      status,
    });
  } catch (e) {
    console.error("invite preview:", e);
    return NextResponse.json({ error: "無法載入邀請。" }, { status: 500 });
  }
}
