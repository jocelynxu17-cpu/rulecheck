import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  processBillingNotify,
  resolveBillingNotifyWorkspaceIdForAudit,
} from "@/lib/billing/notify-ingest";
import {
  billingNotifyBodyAuditSummary,
  fetchWorkspaceBillingAuditSnapshot,
  insertInternalOpsAuditLog,
} from "@/lib/admin/internal-ops-audit";

/**
 * 帳務通知入口：
 * - Legacy：`{ kind?, note? }` — 寫入 payment_events（app），Pro 意圖時將擁有者工作區 `billing_provider` 標記為 app。
 * - 正規化 v1：`{ version:1, idempotency_key, provider, event_type, workspace_id?, billing_state?, metadata? }`
 *   — 安全寫入審計列並將帳務狀態寫回工作區（SSOT）。
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "請先登入。" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "無效的 JSON。" }, { status: 400 });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({
      ok: true,
      mode: "skipped",
      recorded: false,
      duplicate: false,
      workspaceUpdated: false,
      message: "已收到（未設定 SUPABASE_SERVICE_ROLE_KEY，略過審計與工作區寫入）。",
    });
  }

  try {
    const admin = createAdminClient();
    const targetWsId = await resolveBillingNotifyWorkspaceIdForAudit(admin, user, body);
    let beforeWorkspace: Record<string, unknown> | null = null;
    if (targetWsId) {
      beforeWorkspace = await fetchWorkspaceBillingAuditSnapshot(admin, targetWsId);
    }

    const result = await processBillingNotify(admin, user, body);

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    if (result.recorded || result.workspaceUpdated) {
      let afterWorkspace: Record<string, unknown> | null = beforeWorkspace;
      if (targetWsId && result.workspaceUpdated) {
        afterWorkspace = await fetchWorkspaceBillingAuditSnapshot(admin, targetWsId);
      }
      await insertInternalOpsAuditLog(admin, {
        actorUserId: user.id,
        actorEmail: user.email ?? null,
        actionType: "manual_billing_override",
        targetType: targetWsId ? "workspace" : "billing",
        targetId: targetWsId ?? user.id,
        beforeJson: {
          workspace: beforeWorkspace,
          notify: billingNotifyBodyAuditSummary(body),
        },
        afterJson: {
          mode: result.mode,
          recorded: result.recorded,
          duplicate: result.duplicate,
          workspaceUpdated: result.workspaceUpdated,
          message: result.message,
          workspace: afterWorkspace,
        },
        note: null,
      });
    }

    return NextResponse.json({
      ok: true,
      mode: result.mode,
      recorded: result.recorded,
      duplicate: result.duplicate,
      workspaceUpdated: result.workspaceUpdated,
      message: result.message,
    });
  } catch (e) {
    console.error("billing notify:", e);
    return NextResponse.json({ error: "處理失敗。" }, { status: 500 });
  }
}
