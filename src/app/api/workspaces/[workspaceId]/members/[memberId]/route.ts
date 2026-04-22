import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminCanRemoveTarget, canChangeMemberRole } from "@/lib/workspace/member-permissions";

async function countOwners(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspaceId: string
): Promise<number> {
  const { count, error } = await supabase
    .from("workspace_members")
    .select("*", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .eq("role", "owner");
  if (error) return 0;
  return count ?? 0;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string; memberId: string }> }
) {
  const { workspaceId, memberId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "請先登入。" }, { status: 401 });

  let body: { role?: "admin" | "member" };
  try {
    body = (await request.json()) as { role?: "admin" | "member" };
  } catch {
    return NextResponse.json({ error: "無效的 JSON。" }, { status: 400 });
  }

  const nextRole = body.role === "admin" ? "admin" : body.role === "member" ? "member" : null;
  if (!nextRole) {
    return NextResponse.json({ error: "需要 role：admin 或 member。" }, { status: 400 });
  }

  const { data: actor } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!actor?.role || !canChangeMemberRole(actor.role)) {
    return NextResponse.json({ error: "僅擁有者可變更角色。" }, { status: 403 });
  }

  const { data: target } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", memberId)
    .maybeSingle();

  if (!target) return NextResponse.json({ error: "成員不存在。" }, { status: 404 });
  if (target.role === "owner") {
    return NextResponse.json({ error: "無法變更擁有者角色（請先轉移擁有權）。" }, { status: 400 });
  }

  const { error } = await supabase
    .from("workspace_members")
    .update({ role: nextRole })
    .eq("workspace_id", workspaceId)
    .eq("user_id", memberId);

  if (error) {
    console.error("member patch:", error.message);
    return NextResponse.json({ error: "更新失敗。" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, role: nextRole });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ workspaceId: string; memberId: string }> }
) {
  const { workspaceId, memberId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "請先登入。" }, { status: 401 });

  const { data: actor } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!actor?.role || (actor.role !== "owner" && actor.role !== "admin")) {
    return NextResponse.json({ error: "需要管理員權限。" }, { status: 403 });
  }

  const { data: target } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", memberId)
    .maybeSingle();

  if (!target) return NextResponse.json({ error: "成員不存在。" }, { status: 404 });

  if (actor.role === "admin") {
    if (!adminCanRemoveTarget(actor.role, target.role)) {
      return NextResponse.json({ error: "管理員僅能移除一般成員。" }, { status: 403 });
    }
  }

  const owners = await countOwners(supabase, workspaceId);

  if (target.role === "owner") {
    if (owners <= 1) {
      return NextResponse.json({ error: "無法移除最後一位擁有者。" }, { status: 400 });
    }
  }

  if (memberId === user.id && target.role === "owner" && owners <= 1) {
    return NextResponse.json({ error: "你是此工作區唯一擁有者，無法自行離開。" }, { status: 400 });
  }

  const { error } = await supabase
    .from("workspace_members")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("user_id", memberId);

  if (error) {
    console.error("member delete:", error.message);
    return NextResponse.json({ error: "移除失敗。" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
