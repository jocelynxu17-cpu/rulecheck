import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminApi } from "@/lib/admin/assert-admin-api";
import { fetchUserBillingAuditSnapshot, insertInternalOpsAuditLog } from "@/lib/admin/internal-ops-audit";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type PatchBody = {
  monthly_analysis_quota?: unknown;
  plan?: unknown;
  subscription_status?: unknown;
  current_period_end?: unknown;
  cancel_at_period_end?: unknown;
  billing_provider?: unknown;
};

export async function PATCH(request: Request, ctx: { params: Promise<{ userId: string }> }) {
  const auth = await requireAdminApi();
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { userId } = await ctx.params;
  if (!UUID_RE.test(userId)) {
    return NextResponse.json({ error: "使用者 ID 格式不正確。" }, { status: 400 });
  }

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "無效的 JSON。" }, { status: 400 });
  }

  const patch: Record<string, string | number | boolean | null> = {};

  if (body.monthly_analysis_quota !== undefined) {
    const n = Number(body.monthly_analysis_quota);
    if (!Number.isFinite(n) || !Number.isInteger(n)) {
      return NextResponse.json({ error: "monthly_analysis_quota 須為整數。" }, { status: 400 });
    }
    if (n < 0 || n > 50_000_000) {
      return NextResponse.json({ error: "monthly_analysis_quota 超出允許範圍。" }, { status: 400 });
    }
    patch.monthly_analysis_quota = n;
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

  if (body.current_period_end !== undefined) {
    if (body.current_period_end === null || body.current_period_end === "") {
      patch.current_period_end = null;
    } else if (typeof body.current_period_end === "string") {
      const t = Date.parse(body.current_period_end);
      if (!Number.isFinite(t)) {
        return NextResponse.json({ error: "current_period_end 須為有效 ISO 時間。" }, { status: 400 });
      }
      patch.current_period_end = new Date(t).toISOString();
    } else {
      return NextResponse.json({ error: "current_period_end 須為字串或 null。" }, { status: 400 });
    }
  }

  if (body.cancel_at_period_end !== undefined) {
    if (typeof body.cancel_at_period_end === "boolean") {
      patch.cancel_at_period_end = body.cancel_at_period_end;
    } else {
      return NextResponse.json({ error: "cancel_at_period_end 須為布林。" }, { status: 400 });
    }
  }

  if (body.billing_provider !== undefined) {
    if (body.billing_provider === null || body.billing_provider === "") {
      patch.billing_provider = null;
    } else if (typeof body.billing_provider === "string") {
      patch.billing_provider = body.billing_provider.trim().slice(0, 64) || null;
    } else {
      return NextResponse.json({ error: "billing_provider 須為字串或 null。" }, { status: 400 });
    }
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "未提供可更新欄位。" }, { status: 400 });
  }

  try {
    const admin = createAdminClient();
    const beforeSnap = await fetchUserBillingAuditSnapshot(admin, userId);
    if (!beforeSnap) {
      return NextResponse.json({ error: "找不到使用者。" }, { status: 404 });
    }

    const { error: updErr } = await admin.from("users").update(patch).eq("id", userId);
    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 500 });
    }

    const afterSnap = (await fetchUserBillingAuditSnapshot(admin, userId)) ?? beforeSnap;

    const actorId = auth.user.id;
    const actorEmail = auth.user.email ?? null;

    const pick = (snap: Record<string, unknown>, keys: string[]) => {
      const o: Record<string, unknown> = {};
      for (const k of keys) {
        if (k in snap) o[k] = snap[k];
      }
      return o;
    };

    if (body.monthly_analysis_quota !== undefined) {
      await insertInternalOpsAuditLog(admin, {
        actorUserId: actorId,
        actorEmail,
        actionType: "user_quota_update",
        targetType: "user",
        targetId: userId,
        beforeJson: pick(beforeSnap, ["monthly_analysis_quota"]),
        afterJson: pick(afterSnap, ["monthly_analysis_quota"]),
        note: null,
      });
    }
    if (body.plan !== undefined) {
      await insertInternalOpsAuditLog(admin, {
        actorUserId: actorId,
        actorEmail,
        actionType: "user_plan_update",
        targetType: "user",
        targetId: userId,
        beforeJson: pick(beforeSnap, ["plan"]),
        afterJson: pick(afterSnap, ["plan"]),
        note: null,
      });
    }
    if (body.subscription_status !== undefined) {
      await insertInternalOpsAuditLog(admin, {
        actorUserId: actorId,
        actorEmail,
        actionType: "user_subscription_status_update",
        targetType: "user",
        targetId: userId,
        beforeJson: pick(beforeSnap, ["subscription_status"]),
        afterJson: pick(afterSnap, ["subscription_status"]),
        note: null,
      });
    }
    if (body.current_period_end !== undefined) {
      await insertInternalOpsAuditLog(admin, {
        actorUserId: actorId,
        actorEmail,
        actionType: "user_period_end_update",
        targetType: "user",
        targetId: userId,
        beforeJson: pick(beforeSnap, ["current_period_end"]),
        afterJson: pick(afterSnap, ["current_period_end"]),
        note: null,
      });
    }
    if (body.cancel_at_period_end !== undefined) {
      await insertInternalOpsAuditLog(admin, {
        actorUserId: actorId,
        actorEmail,
        actionType: "user_cancel_at_period_end_update",
        targetType: "user",
        targetId: userId,
        beforeJson: pick(beforeSnap, ["cancel_at_period_end"]),
        afterJson: pick(afterSnap, ["cancel_at_period_end"]),
        note: null,
      });
    }
    if (body.billing_provider !== undefined) {
      await insertInternalOpsAuditLog(admin, {
        actorUserId: actorId,
        actorEmail,
        actionType: "user_billing_provider_update",
        targetType: "user",
        targetId: userId,
        beforeJson: pick(beforeSnap, ["billing_provider"]),
        afterJson: pick(afterSnap, ["billing_provider"]),
        note: null,
      });
    }

    return NextResponse.json({ ok: true, updated: patch });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "update_failed";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
