import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminApi } from "@/lib/admin/assert-admin-api";
import { insertInternalOpsAuditLog } from "@/lib/admin/internal-ops-audit";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type PatchBody = {
  monthly_quota_units?: unknown;
  plan?: unknown;
  subscription_status?: unknown;
};

export async function PATCH(request: Request, ctx: { params: Promise<{ workspaceId: string }> }) {
  const auth = await requireAdminApi();
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { workspaceId } = await ctx.params;
  if (!UUID_RE.test(workspaceId)) {
    return NextResponse.json({ error: "工作區 ID 格式不正確。" }, { status: 400 });
  }

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "無效的 JSON。" }, { status: 400 });
  }

  const patch: Record<string, string | number | null> = {};

  if (body.monthly_quota_units !== undefined) {
    const n = Number(body.monthly_quota_units);
    if (!Number.isFinite(n) || !Number.isInteger(n)) {
      return NextResponse.json({ error: "monthly_quota_units 須為整數。" }, { status: 400 });
    }
    if (n < 0 || n > 50_000_000) {
      return NextResponse.json({ error: "monthly_quota_units 超出允許範圍。" }, { status: 400 });
    }
    patch.monthly_quota_units = n;
  }

  if (body.plan !== undefined) {
    if (body.plan === null) {
      patch.plan = "free";
    } else if (typeof body.plan === "string") {
      const p = body.plan.trim().slice(0, 64);
      if (!p) {
        return NextResponse.json({ error: "plan 不可為空字串。" }, { status: 400 });
      }
      patch.plan = p;
    } else {
      return NextResponse.json({ error: "plan 須為字串。" }, { status: 400 });
    }
  }

  if (body.subscription_status !== undefined) {
    if (body.subscription_status === null || body.subscription_status === "") {
      patch.subscription_status = null;
    } else if (typeof body.subscription_status === "string") {
      patch.subscription_status = body.subscription_status.trim().slice(0, 64) || null;
    } else {
      return NextResponse.json({ error: "subscription_status 須為字串或 null。" }, { status: 400 });
    }
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "未提供可更新欄位。" }, { status: 400 });
  }

  try {
    const admin = createAdminClient();
    const { data: existing, error: findErr } = await admin
      .from("workspaces")
      .select("id, monthly_quota_units, plan, subscription_status")
      .eq("id", workspaceId)
      .maybeSingle();
    if (findErr) {
      return NextResponse.json({ error: findErr.message }, { status: 500 });
    }
    if (!existing) {
      return NextResponse.json({ error: "找不到工作區。" }, { status: 404 });
    }

    const before = {
      monthly_quota_units: existing.monthly_quota_units as number,
      plan: existing.plan as string,
      subscription_status: (existing.subscription_status as string | null) ?? null,
    };

    const { error: updErr } = await admin.from("workspaces").update(patch).eq("id", workspaceId);
    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 500 });
    }

    const { data: afterRow } = await admin
      .from("workspaces")
      .select("monthly_quota_units, plan, subscription_status")
      .eq("id", workspaceId)
      .maybeSingle();

    const after = afterRow
      ? {
          monthly_quota_units: afterRow.monthly_quota_units as number,
          plan: afterRow.plan as string,
          subscription_status: (afterRow.subscription_status as string | null) ?? null,
        }
      : before;

    const actorId = auth.user.id;
    const actorEmail = auth.user.email ?? null;

    if (body.monthly_quota_units !== undefined) {
      await insertInternalOpsAuditLog(admin, {
        actorUserId: actorId,
        actorEmail,
        actionType: "workspace_quota_update",
        targetType: "workspace",
        targetId: workspaceId,
        beforeJson: { monthly_quota_units: before.monthly_quota_units },
        afterJson: { monthly_quota_units: after.monthly_quota_units },
        note: null,
      });
    }
    if (body.plan !== undefined) {
      await insertInternalOpsAuditLog(admin, {
        actorUserId: actorId,
        actorEmail,
        actionType: "workspace_plan_update",
        targetType: "workspace",
        targetId: workspaceId,
        beforeJson: { plan: before.plan },
        afterJson: { plan: after.plan },
        note: null,
      });
    }
    if (body.subscription_status !== undefined) {
      await insertInternalOpsAuditLog(admin, {
        actorUserId: actorId,
        actorEmail,
        actionType: "workspace_subscription_status_update",
        targetType: "workspace",
        targetId: workspaceId,
        beforeJson: { subscription_status: before.subscription_status },
        afterJson: { subscription_status: after.subscription_status },
        note: null,
      });
    }

    return NextResponse.json({ ok: true, updated: patch });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "update_failed";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
