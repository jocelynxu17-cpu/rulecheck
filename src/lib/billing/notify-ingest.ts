import type { SupabaseClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";
import { recordPaymentEventIfNew } from "@/lib/billing/payment-events";
import { toCanonicalSubscriptionStatus } from "@/lib/billing/subscription-status-canonical";
import {
  applyWorkspaceBillingState,
  assertUserOwnsWorkspaceForBilling,
  getOwnerWorkspaceIdForUserAdmin,
  type WorkspaceBillingStatePatch,
} from "@/lib/billing/workspace-billing-persistence";

/** 正規化帳務通知（供 App／未來 NewebPay 等 adapter 共用）。 */
export type BillingNotifyEventV1 = {
  version: 1;
  idempotency_key: string;
  provider: string;
  event_type: string;
  workspace_id?: string;
  billing_state?: BillingNotifyBillingStateV1;
  metadata?: Record<string, unknown>;
};

export type BillingNotifyBillingStateV1 = {
  plan?: string;
  subscription_status?: string | null;
  monthly_quota_units?: number;
  current_period_end?: string | null;
  cancel_at_period_end?: boolean;
  billing_provider?: string | null;
};

export type BillingNotifyLegacyBody = {
  kind?: string;
  note?: string;
};

export type BillingNotifySuccess =
  | {
      ok: true;
      mode: "legacy";
      recorded: boolean;
      duplicate: boolean;
      message: string;
      workspaceUpdated: boolean;
    }
  | {
      ok: true;
      mode: "billing_v1";
      recorded: boolean;
      duplicate: boolean;
      message: string;
      workspaceUpdated: boolean;
    };

export type BillingNotifyFailure = { ok: false; status: number; error: string };

export type BillingNotifyResult = BillingNotifySuccess | BillingNotifyFailure;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function isBillingNotifyEventV1(body: unknown): body is BillingNotifyEventV1 {
  if (!isRecord(body)) return false;
  if (body.version !== 1) return false;
  if (typeof body.idempotency_key !== "string" || !body.idempotency_key.trim()) return false;
  if (typeof body.provider !== "string" || !body.provider.trim()) return false;
  if (typeof body.event_type !== "string" || !body.event_type.trim()) return false;
  return true;
}

function sanitizeKindToken(kind: string): string {
  const s = kind.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 48);
  return s || "generic";
}

function parseIsoOrNull(v: unknown): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  if (!t) return null;
  const d = Date.parse(t);
  if (Number.isNaN(d)) return undefined;
  return new Date(d).toISOString();
}

export function billingStateV1ToWorkspacePatch(raw: BillingNotifyBillingStateV1 | undefined): WorkspaceBillingStatePatch | null {
  if (!raw || typeof raw !== "object") return null;
  const patch: WorkspaceBillingStatePatch = {};

  if (typeof raw.plan === "string") {
    const p = raw.plan.trim().slice(0, 64);
    if (p) patch.plan = p;
  }

  if ("subscription_status" in raw) {
    patch.subscription_status = toCanonicalSubscriptionStatus(
      raw.subscription_status === null || raw.subscription_status === undefined
        ? null
        : String(raw.subscription_status)
    );
  }

  if (typeof raw.monthly_quota_units === "number" && Number.isFinite(raw.monthly_quota_units)) {
    const q = Math.round(raw.monthly_quota_units);
    if (q >= 0 && q <= 50_000_000) {
      patch.monthly_quota_units = q;
    }
  }

  if ("current_period_end" in raw) {
    const iso = parseIsoOrNull(raw.current_period_end);
    if (iso !== undefined) {
      patch.current_period_end = iso;
    }
  }

  if (typeof raw.cancel_at_period_end === "boolean") {
    patch.cancel_at_period_end = raw.cancel_at_period_end;
  }

  if ("billing_provider" in raw) {
    if (raw.billing_provider === null || raw.billing_provider === undefined) {
      patch.billing_provider = null;
    } else if (typeof raw.billing_provider === "string") {
      const b = raw.billing_provider.trim().slice(0, 48).toLowerCase();
      patch.billing_provider = b || null;
    }
  }

  return Object.keys(patch).length > 0 ? patch : null;
}

function sanitizeProviderId(provider: string): string {
  return provider.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 32) || "unknown";
}

const WORKSPACE_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function processBillingNotify(
  admin: SupabaseClient,
  user: User,
  body: unknown
): Promise<BillingNotifyResult> {
  if (isBillingNotifyEventV1(body)) {
    const idempotencyKey = body.idempotency_key.trim().slice(0, 500);
    const provider = sanitizeProviderId(body.provider);
    const eventType = body.event_type.trim().slice(0, 160);
    const meta = isRecord(body.metadata) ? body.metadata : {};

    const rawWs = typeof body.workspace_id === "string" ? body.workspace_id.trim() : "";
    let workspaceId: string;
    if (rawWs) {
      if (!WORKSPACE_UUID_RE.test(rawWs)) {
        return { ok: false, status: 400, error: "工作區 ID 格式不正確。" };
      }
      const ok = await assertUserOwnsWorkspaceForBilling(admin, user.id, rawWs);
      if (!ok) {
        return { ok: false, status: 403, error: "僅擁有者可更新該工作區帳務狀態。" };
      }
      workspaceId = rawWs;
    } else {
      const wid = await getOwnerWorkspaceIdForUserAdmin(admin, user.id);
      if (!wid) {
        return { ok: false, status: 400, error: "找不到擁有者工作區，無法套用帳務狀態。" };
      }
      workspaceId = wid;
    }

    const statePatch = billingStateV1ToWorkspacePatch(body.billing_state);
    const payload: Record<string, unknown> = {
      ...meta,
      workspace_id: workspaceId,
      billing_state: body.billing_state ?? null,
    };

    const recorded = await recordPaymentEventIfNew(admin, {
      userId: user.id,
      subscriptionId: null,
      provider,
      eventType,
      idempotencyKey,
      payload,
    });

    if (!recorded.ok) {
      return { ok: false, status: 500, error: recorded.error };
    }

    let workspaceUpdated = false;
    if (statePatch) {
      const applied = await applyWorkspaceBillingState(admin, workspaceId, statePatch);
      if (!applied.ok) {
        return { ok: false, status: 500, error: applied.error };
      }
      workspaceUpdated = true;
    }

    return {
      ok: true,
      mode: "billing_v1",
      recorded: recorded.inserted,
      duplicate: !recorded.inserted,
      workspaceUpdated,
      message: recorded.inserted
        ? "已記錄事件並同步工作區帳務。"
        : statePatch
          ? "事件已存在（idempotent）；已再次套用帳務狀態。"
          : "事件已存在（idempotent）。",
    };
  }

  const legacy = (isRecord(body) ? body : {}) as BillingNotifyLegacyBody;
  const kind = typeof legacy.kind === "string" && legacy.kind.trim() ? legacy.kind.trim() : "generic";
  const safeKind = sanitizeKindToken(kind);
  const ymd = new Date().toISOString().slice(0, 10);
  const idempotencyKey = `notify:${user.id}:${safeKind}:${ymd}`;
  const eventType = safeKind === "pro_interest" ? "notify_pro_interest" : `notify_${safeKind}`;

  const recorded = await recordPaymentEventIfNew(admin, {
    userId: user.id,
    subscriptionId: null,
    provider: "app",
    eventType,
    idempotencyKey,
    payload: {
      email: user.email ?? null,
      note: typeof legacy.note === "string" ? legacy.note.slice(0, 2000) : null,
      kind: safeKind,
    },
  });

  if (!recorded.ok) {
    return { ok: false, status: 500, error: recorded.error };
  }

  let workspaceUpdated = false;
  const ownerWs = await getOwnerWorkspaceIdForUserAdmin(admin, user.id);
  if (ownerWs && safeKind === "pro_interest") {
    const hint = await applyWorkspaceBillingState(admin, ownerWs, { billing_provider: "app" });
    if (!hint.ok) {
      return { ok: false, status: 500, error: hint.error };
    }
    workspaceUpdated = true;
  }

  return {
    ok: true,
    mode: "legacy",
    recorded: recorded.inserted,
    duplicate: !recorded.inserted,
    workspaceUpdated,
    message: recorded.inserted ? "已記錄你的意願。" : "今日已記錄過，無需重複提交。",
  };
}

/**
 * 與 `processBillingNotify` 相同之工作區解析邏輯，供稽核在處理前擷取 before 快照（失敗時回傳 null）。
 */
export async function resolveBillingNotifyWorkspaceIdForAudit(
  admin: SupabaseClient,
  user: User,
  body: unknown
): Promise<string | null> {
  if (isBillingNotifyEventV1(body)) {
    const rawWs = typeof body.workspace_id === "string" ? body.workspace_id.trim() : "";
    if (rawWs) {
      if (!WORKSPACE_UUID_RE.test(rawWs)) return null;
      const ok = await assertUserOwnsWorkspaceForBilling(admin, user.id, rawWs);
      return ok ? rawWs : null;
    }
    return (await getOwnerWorkspaceIdForUserAdmin(admin, user.id)) ?? null;
  }
  return (await getOwnerWorkspaceIdForUserAdmin(admin, user.id)) ?? null;
}
