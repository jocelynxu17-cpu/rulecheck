import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminApi } from "@/lib/admin/assert-admin-api";
import { runGlobalWorkspaceRepair } from "@/lib/admin/workspace-repair-admin";
import { insertInternalOpsAuditLog } from "@/lib/admin/internal-ops-audit";

export async function POST() {
  const auth = await requireAdminApi();
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const admin = createAdminClient();
    const result = await runGlobalWorkspaceRepair(admin);
    await insertInternalOpsAuditLog(admin, {
      actorUserId: auth.user.id,
      actorEmail: auth.user.email ?? null,
      actionType: "workspace_repair",
      targetType: "system",
      targetId: null,
      beforeJson: { scope: "global" },
      afterJson: {
        usersProvisioned: result.usersProvisioned,
        ownersLinked: result.ownersLinked,
      },
      note: null,
    });
    return NextResponse.json({
      ok: true,
      usersProvisioned: result.usersProvisioned,
      ownersLinked: result.ownersLinked,
      message:
        result.usersProvisioned === 0 && result.ownersLinked === 0
          ? "未發現需修復項目（資料已一致）。"
          : `已新建 ${result.usersProvisioned} 個使用者工作區，補齊 ${result.ownersLinked} 筆擁有者成員。`,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "repair_failed";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
