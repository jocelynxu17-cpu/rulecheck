import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  const { workspaceId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "請先登入。" }, { status: 401 });

  const { data: mem } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!mem) return NextResponse.json({ error: "無權限。" }, { status: 403 });

  const { data: members, error } = await supabase
    .from("workspace_members")
    .select("user_id, role, created_at")
    .eq("workspace_id", workspaceId);

  if (error) return NextResponse.json({ error: "無法載入成員。" }, { status: 500 });

  const ids = (members ?? []).map((m) => m.user_id);
  let emails: Record<string, string> = {};
  try {
    const admin = createAdminClient();
    const { data: users } = await admin.from("users").select("id, email").in("id", ids);
    emails = Object.fromEntries((users ?? []).map((u) => [u.id, u.email ?? ""]));
  } catch {
    /* service role missing locally */
  }

  return NextResponse.json({
    members: (members ?? []).map((m) => ({
      userId: m.user_id,
      role: m.role,
      email: emails[m.user_id] ?? "—",
      createdAt: m.created_at,
    })),
  });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  const { workspaceId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "請先登入。" }, { status: 401 });

  let targetUserId: string;
  try {
    const b = (await request.json()) as { userId?: string };
    if (typeof b.userId !== "string") throw new Error();
    targetUserId = b.userId;
  } catch {
    return NextResponse.json({ error: "需要 userId。" }, { status: 400 });
  }

  const { data: self } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!self || (self.role !== "owner" && self.role !== "admin")) {
    return NextResponse.json({ error: "需要管理員權限。" }, { status: 403 });
  }

  const { data: target } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", targetUserId)
    .maybeSingle();

  if (!target) return NextResponse.json({ error: "成員不存在。" }, { status: 404 });
  if (target.role === "owner") {
    return NextResponse.json({ error: "無法移除擁有者。" }, { status: 400 });
  }
  if (targetUserId === user.id) {
    return NextResponse.json({ error: "無法移除自己（請聯絡擁有者）。" }, { status: 400 });
  }

  const { error } = await supabase.from("workspace_members").delete().eq("workspace_id", workspaceId).eq("user_id", targetUserId);

  if (error) {
    console.error("remove member:", error.message);
    return NextResponse.json({ error: "移除失敗。" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
