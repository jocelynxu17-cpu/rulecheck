import type { SupabaseClient } from "@supabase/supabase-js";
import { isBillingNotifyEventV1 } from "@/lib/billing/notify-ingest";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** 稽核用精簡 payload，避免寫入過大 JSON。 */
export function billingNotifyBodyAuditSummary(body: unknown): Record<string, unknown> {
  if (isBillingNotifyEventV1(body)) {
    return {
      version: 1,
      idempotency_key: body.idempotency_key,
      provider: body.provider,
      event_type: body.event_type,
      workspace_id: body.workspace_id ?? null,
      has_billing_state: Boolean(body.billing_state && typeof body.billing_state === "object"),
    };
  }
  if (isRecord(body)) {
    return {
      legacy_kind: typeof body.kind === "string" ? body.kind.slice(0, 64) : null,
      has_note: typeof body.note === "string",
    };
  }
  return { raw: "unparsed" };
}

export const INTERNAL_OPS_AUDIT_ACTIONS = [
  "workspace_repair",
  "workspace_quota_update",
  "workspace_plan_update",
  "workspace_subscription_status_update",
  "manual_billing_override",
  "user_password_recovery_request",
  "user_password_recovery_force",
  "user_ban_update",
  "user_quota_update",
  "user_plan_update",
  "user_subscription_status_update",
  "user_period_end_update",
  "user_cancel_at_period_end_update",
  "user_billing_provider_update",
  "user_manual_override",
] as const;

export type InternalOpsAuditActionType = (typeof INTERNAL_OPS_AUDIT_ACTIONS)[number];

export type InternalOpsAuditTargetType = "workspace" | "system" | "billing" | "user";

export type InternalOpsAuditRow = {
  id: string;
  actor_user_id: string | null;
  actor_email: string | null;
  action_type: string;
  target_type: string;
  target_id: string | null;
  before_json: Record<string, unknown>;
  after_json: Record<string, unknown>;
  note: string | null;
  created_at: string;
};

export type InsertInternalOpsAuditInput = {
  actorUserId: string;
  actorEmail: string | null;
  actionType: InternalOpsAuditActionType;
  targetType: InternalOpsAuditTargetType;
  targetId: string | null;
  beforeJson: Record<string, unknown>;
  afterJson: Record<string, unknown>;
  note?: string | null;
};

/** Best-effort: never throw; failures are logged only. */
export async function insertInternalOpsAuditLog(
  admin: SupabaseClient,
  input: InsertInternalOpsAuditInput
): Promise<void> {
  const { error } = await admin.from("internal_ops_audit_log").insert({
    actor_user_id: input.actorUserId,
    actor_email: input.actorEmail,
    action_type: input.actionType,
    target_type: input.targetType,
    target_id: input.targetId,
    before_json: input.beforeJson,
    after_json: input.afterJson,
    note: input.note ?? null,
  });
  if (error) {
    console.error("[internal_ops_audit] insert failed:", error.message, input.actionType);
  }
}

const WORKSPACE_AUDIT_SELECT =
  "id, plan, subscription_status, monthly_quota_units, billing_provider, cancel_at_period_end, current_period_end";

export async function fetchWorkspaceBillingAuditSnapshot(
  admin: SupabaseClient,
  workspaceId: string
): Promise<Record<string, unknown> | null> {
  const { data, error } = await admin
    .from("workspaces")
    .select(WORKSPACE_AUDIT_SELECT)
    .eq("id", workspaceId)
    .maybeSingle();
  if (error || !data) return null;
  return data as unknown as Record<string, unknown>;
}

const USER_AUDIT_SELECT =
  "id, plan, subscription_status, monthly_analysis_quota, billing_provider, cancel_at_period_end, current_period_end";

export async function fetchUserBillingAuditSnapshot(
  admin: SupabaseClient,
  userId: string
): Promise<Record<string, unknown> | null> {
  const { data, error } = await admin.from("users").select(USER_AUDIT_SELECT).eq("id", userId).maybeSingle();
  if (error || !data) return null;
  return data as unknown as Record<string, unknown>;
}

const AUDIT_SELECT =
  "id, actor_user_id, actor_email, action_type, target_type, target_id, before_json, after_json, note, created_at";

function mapAuditRows(data: unknown[] | null): InternalOpsAuditRow[] {
  return (data ?? []).map((raw) => {
    const r = raw as Record<string, unknown>;
    return {
    id: String(r.id),
    actor_user_id: r.actor_user_id == null ? null : String(r.actor_user_id),
    actor_email: r.actor_email == null ? null : String(r.actor_email),
    action_type: String(r.action_type),
    target_type: String(r.target_type),
    target_id: r.target_id == null ? null : String(r.target_id),
    before_json: (r.before_json && typeof r.before_json === "object" ? r.before_json : {}) as Record<string, unknown>,
    after_json: (r.after_json && typeof r.after_json === "object" ? r.after_json : {}) as Record<string, unknown>,
    note: r.note == null ? null : String(r.note),
    created_at: String(r.created_at),
    };
  });
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function escapeIlikePattern(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

/** 目標欄位或 before/after JSON 內是否出現該 UUID（含巢狀 `id` / `workspace_id`）。 */
export function rowTouchesWorkspaceUuid(row: InternalOpsAuditRow, workspaceId: string): boolean {
  if (row.target_id === workspaceId) return true;
  const visit = (v: unknown, depth: number): boolean => {
    if (depth > 12) return false;
    if (v === workspaceId) return true;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      const o = v as Record<string, unknown>;
      if (o.id === workspaceId) return true;
      if (o.workspace_id === workspaceId) return true;
      return Object.values(o).some((x) => visit(x, depth + 1));
    }
    if (Array.isArray(v)) return v.some((x) => visit(x, depth + 1));
    return false;
  };
  return visit(row.before_json, 0) || visit(row.after_json, 0);
}

function rowMatchesTargetSubstring(row: InternalOpsAuditRow, q: string): boolean {
  const needle = q.toLowerCase();
  if (row.target_id?.toLowerCase().includes(needle)) return true;
  try {
    const blob = `${JSON.stringify(row.before_json)}${JSON.stringify(row.after_json)}`.toLowerCase();
    return blob.includes(needle);
  } catch {
    return false;
  }
}

export type InternalOpsAuditQueryFilters = {
  actionType?: string | null;
  actorEmail?: string | null;
  /** 比對 `target_id` 或 JSON 內工作區 UUID／任意子字串（非 UUID 時為寬鬆搜尋） */
  targetId?: string | null;
};

/**
 * 依條件載入稽核列。
 * - 無 `targetId`：PostgREST `range` 分頁（over-fetch 一筆判斷下一頁）。
 * - 有 `targetId`：先拉固定視窗再在記憶體比對 JSON；分頁僅在該視窗內有效（大量資料時請縮小條件）。
 */
export async function fetchInternalOpsAuditLogsFiltered(
  admin: SupabaseClient,
  filters: InternalOpsAuditQueryFilters,
  resultLimit: number,
  options?: { offset?: number }
): Promise<{ rows: InternalOpsAuditRow[]; error: string | null; hasNextPage: boolean }> {
  const tid = filters.targetId?.trim() ?? "";
  const action = filters.actionType?.trim() ?? "";
  const email = filters.actorEmail?.trim() ?? "";
  const offset = Math.max(0, options?.offset ?? 0);
  const pageSize = Math.max(1, Math.min(resultLimit, 500));

  const needsPostFilter = Boolean(tid);
  const poolLimit = needsPostFilter ? Math.min(500, Math.max(pageSize * 4, 120)) : null;

  let q = admin.from("internal_ops_audit_log").select(AUDIT_SELECT).order("created_at", { ascending: false });

  if (action && INTERNAL_OPS_AUDIT_ACTIONS.includes(action as InternalOpsAuditActionType)) {
    q = q.eq("action_type", action);
  }
  if (email) {
    q = q.ilike("actor_email", `%${escapeIlikePattern(email)}%`);
  }

  if (!needsPostFilter) {
    const end = offset + pageSize;
    const { data, error } = await q.range(offset, end);
    if (error) {
      return { rows: [], error: error.message, hasNextPage: false };
    }
    const mapped = mapAuditRows(data);
    const hasNextPage = mapped.length > pageSize;
    const rows = mapped.slice(0, pageSize);
    return { rows, error: null, hasNextPage };
  }

  q = q.limit(poolLimit ?? 500);

  const { data, error } = await q;
  if (error) {
    return { rows: [], error: error.message, hasNextPage: false };
  }

  let rows = mapAuditRows(data);

  if (tid) {
    if (UUID_RE.test(tid)) {
      rows = rows.filter((r) => rowTouchesWorkspaceUuid(r, tid));
    } else {
      rows = rows.filter((r) => rowMatchesTargetSubstring(r, tid));
    }
  }

  const hasNextPage = rows.length > offset + pageSize;
  const paged = rows.slice(offset, offset + pageSize);
  return { rows: paged, error: null, hasNextPage };
}

export async function fetchRecentInternalOpsAuditLogs(
  admin: SupabaseClient,
  limit: number
): Promise<{ rows: InternalOpsAuditRow[]; error: string | null; hasNextPage: boolean }> {
  return fetchInternalOpsAuditLogsFiltered(admin, {}, limit, { offset: 0 });
}
