import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminApi } from "@/lib/admin/assert-admin-api";
import { runSingleWorkspaceRepair } from "@/lib/admin/workspace-repair-admin";
import { insertInternalOpsAuditLog } from "@/lib/admin/internal-ops-audit";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(_request: Request, ctx: { params: Promise<{ workspaceId: string }> }) {
  const auth = await requireAdminApi();
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { workspaceId } = await ctx.params;
  if (!UUID_RE.test(workspaceId)) {
    return NextResponse.json({ error: "工作區 ID 格式不正確。" }, { status: 400 });
  }

  try {
    const admin = createAdminClient();

    const { data: ws } = await admin.from("workspaces").select("id, created_by").eq("id", workspaceId).maybeSingle();
    let ownerMemberExisted = false;
    if (ws?.created_by) {
      const { data: mem } = await admin
        .from("workspace_members")
        .select("user_id")
        .eq("workspace_id", workspaceId)
        .eq("user_id", ws.created_by as string)
        .maybeSingle();
      ownerMemberExisted = Boolean(mem);
    }

    const result = await runSingleWorkspaceRepair(admin, workspaceId);

    await insertInternalOpsAuditLog(admin, {
      actorUserId: auth.user.id,
      actorEmail: auth.user.email ?? null,
      actionType: "workspace_repair",
      targetType: "workspace",
      targetId: workspaceId,
      beforeJson: { scope: "single", owner_member_for_creator_existed: ownerMemberExisted },
      afterJson: { ownersLinked: result.ownersLinked, message: result.message },
      note: null,
    });

    return NextResponse.json({ ok: true, ownersLinked: result.ownersLinked, message: result.message });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "repair_failed";
    if (msg === "workspace_not_found") {
      return NextResponse.json({ ok: false, error: "找不到工作區。" }, { status: 404 });
    }
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
