import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { randomBytes } from "crypto";

async function assertAdminForWorkspace(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspaceId: string,
  userId: string
) {
  const { data: mem } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!mem || (mem.role !== "owner" && mem.role !== "admin")) {
    return false;
  }
  return true;
}

/** Soft-revoke a pending invite. */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ workspaceId: string; inviteId: string }> }
) {
  const { workspaceId, inviteId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "請先登入。" }, { status: 401 });

  if (!(await assertAdminForWorkspace(supabase, workspaceId, user.id))) {
    return NextResponse.json({ error: "需要管理員權限。" }, { status: 403 });
  }

  const { data: inv, error: fetchErr } = await supabase
    .from("workspace_invites")
    .select("id, workspace_id, accepted_at, revoked_at")
    .eq("id", inviteId)
    .maybeSingle();

  if (fetchErr || !inv || inv.workspace_id !== workspaceId) {
    return NextResponse.json({ error: "找不到邀請。" }, { status: 404 });
  }
  if (inv.accepted_at) {
    return NextResponse.json({ error: "此邀請已完成，無法撤銷。" }, { status: 400 });
  }
  if (inv.revoked_at) {
    return NextResponse.json({ error: "此邀請已撤銷。" }, { status: 400 });
  }

  const { error } = await supabase.from("workspace_invites").update({ revoked_at: new Date().toISOString() }).eq("id", inviteId);

  if (error) {
    console.error("invite revoke:", error.message);
    return NextResponse.json({ error: "撤銷失敗。" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

/** Resend: rotate token and extend expiry (pending or expired, not revoked/accepted). */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string; inviteId: string }> }
) {
  const { workspaceId, inviteId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "請先登入。" }, { status: 401 });

  let body: { action?: string };
  try {
    body = (await request.json()) as { action?: string };
  } catch {
    return NextResponse.json({ error: "無效的 JSON。" }, { status: 400 });
  }

  if (body.action !== "resend") {
    return NextResponse.json({ error: "不支援的操作。" }, { status: 400 });
  }

  if (!(await assertAdminForWorkspace(supabase, workspaceId, user.id))) {
    return NextResponse.json({ error: "需要管理員權限。" }, { status: 403 });
  }

  const { data: inv, error: fetchErr } = await supabase
    .from("workspace_invites")
    .select("id, workspace_id, accepted_at, revoked_at")
    .eq("id", inviteId)
    .maybeSingle();

  if (fetchErr || !inv || inv.workspace_id !== workspaceId) {
    return NextResponse.json({ error: "找不到邀請。" }, { status: 404 });
  }
  if (inv.accepted_at) {
    return NextResponse.json({ error: "此邀請已完成，無法重新寄送。" }, { status: 400 });
  }
  if (inv.revoked_at) {
    return NextResponse.json({ error: "已撤銷的邀請請重新建立。" }, { status: 400 });
  }

  const token = randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString();

  const { error: upErr } = await supabase
    .from("workspace_invites")
    .update({ token, expires_at: expiresAt, invited_by: user.id, revoked_at: null })
    .eq("id", inviteId);

  if (upErr) {
    console.error("invite resend:", upErr.message);
    return NextResponse.json({ error: "更新邀請失敗。" }, { status: 500 });
  }

  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const inviteUrl = `${site}/team/join?token=${token}`;

  return NextResponse.json({ ok: true, inviteUrl, expiresAt });
}
