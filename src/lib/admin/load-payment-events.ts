import { createAdminClient } from "@/lib/supabase/admin";
import { filterPaymentEventsForWorkspace } from "@/lib/admin/payment-events-workspace-scope";
import {
  INTERNAL_PAYMENT_BATCH_SCAN_MAX,
  INTERNAL_PAYMENT_PAGE_DEFAULT,
  INTERNAL_PAYMENT_PAGE_MAX,
  clampPageSize,
} from "@/lib/admin/internal-scale-conventions";

export type AdminPaymentEventDetail = {
  id: string;
  provider: string;
  event_type: string;
  created_at: string;
  user_id: string | null;
  subscription_id: string | null;
  idempotency_key: string;
  payload: Record<string, unknown>;
  user_email: string | null;
};

/**
 * Global payment_events list with bounded page size (over-fetch one row for `hasNextPage`).
 * Use `maxLimit` only for internal batch scans (e.g. analysis correlation), not default UI.
 */
export async function loadPaymentEvents(options?: {
  limit?: number;
  offset?: number;
  maxLimit?: number;
}): Promise<{
  rows: AdminPaymentEventDetail[];
  error: string | null;
  hasNextPage: boolean;
}> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { rows: [], error: "未設定 SUPABASE_SERVICE_ROLE_KEY。", hasNextPage: false };
  }

  const cap = options?.maxLimit ?? INTERNAL_PAYMENT_PAGE_MAX;
  const pageSize = clampPageSize(options?.limit, INTERNAL_PAYMENT_PAGE_DEFAULT, cap);
  const offset = Math.max(0, options?.offset ?? 0);
  const fetchEnd = offset + pageSize;

  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("payment_events")
      .select(
        `
        id,
        provider,
        event_type,
        created_at,
        user_id,
        subscription_id,
        idempotency_key,
        payload,
        users ( email )
      `
      )
      .order("created_at", { ascending: false })
      .range(offset, fetchEnd);

    if (error) {
      return { rows: [], error: error.message, hasNextPage: false };
    }

    const batch = (data ?? []) as Record<string, unknown>[];
    const hasNextPage = batch.length > pageSize;
    const slice = batch.slice(0, pageSize);

    const rows: AdminPaymentEventDetail[] = slice.map((row) => {
      const users = row.users as { email: string | null } | { email: string | null }[] | null;
      const email = Array.isArray(users) ? users[0]?.email ?? null : users?.email ?? null;
      return {
        id: row.id as string,
        provider: row.provider as string,
        event_type: row.event_type as string,
        created_at: row.created_at as string,
        user_id: (row.user_id as string | null) ?? null,
        subscription_id: (row.subscription_id as string | null) ?? null,
        idempotency_key: row.idempotency_key as string,
        payload: (row.payload as Record<string, unknown>) ?? {},
        user_email: email,
      };
    });

    return { rows, error: null, hasNextPage };
  } catch (e) {
    return { rows: [], error: e instanceof Error ? e.message : "載入失敗", hasNextPage: false };
  }
}

/** 依 workspace_id（payload）或成員 user_id 篩選；先拉固定上限再過濾，可分頁但僅在該視窗內。 */
export async function loadPaymentEventsForWorkspace(
  workspaceId: string,
  options?: {
    fetchLimit?: number;
    offset?: number;
    pageSize?: number;
  }
): Promise<{ rows: AdminPaymentEventDetail[]; error: string | null; hasNextPage: boolean }> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { rows: [], error: "未設定 SUPABASE_SERVICE_ROLE_KEY。", hasNextPage: false };
  }

  const fetchLimit = Math.min(options?.fetchLimit ?? INTERNAL_PAYMENT_BATCH_SCAN_MAX, 800);
  const pageSize = clampPageSize(
    options?.pageSize,
    INTERNAL_PAYMENT_PAGE_DEFAULT,
    INTERNAL_PAYMENT_PAGE_MAX
  );
  const offset = Math.max(0, options?.offset ?? 0);

  try {
    const admin = createAdminClient();

    const { data: memRows, error: memErr } = await admin
      .from("workspace_members")
      .select("user_id")
      .eq("workspace_id", workspaceId);

    if (memErr) {
      return { rows: [], error: memErr.message, hasNextPage: false };
    }

    const memberIds = new Set((memRows ?? []).map((r: { user_id: string }) => r.user_id));

    const { data, error } = await admin
      .from("payment_events")
      .select(
        `
        id,
        provider,
        event_type,
        created_at,
        user_id,
        subscription_id,
        idempotency_key,
        payload,
        users ( email )
      `
      )
      .order("created_at", { ascending: false })
      .limit(fetchLimit);

    if (error) {
      return { rows: [], error: error.message, hasNextPage: false };
    }

    const mapped: AdminPaymentEventDetail[] = (data ?? []).map((row: Record<string, unknown>) => {
      const users = row.users as { email: string | null } | { email: string | null }[] | null;
      const email = Array.isArray(users) ? users[0]?.email ?? null : users?.email ?? null;
      return {
        id: row.id as string,
        provider: row.provider as string,
        event_type: row.event_type as string,
        created_at: row.created_at as string,
        user_id: (row.user_id as string | null) ?? null,
        subscription_id: (row.subscription_id as string | null) ?? null,
        idempotency_key: String(row.idempotency_key ?? ""),
        payload: (row.payload as Record<string, unknown>) ?? {},
        user_email: email,
      };
    });

    const filtered = filterPaymentEventsForWorkspace(mapped, workspaceId, memberIds);
    const hasNextPage = filtered.length > offset + pageSize;
    const rows = filtered.slice(offset, offset + pageSize);
    return { rows, error: null, hasNextPage };
  } catch (e) {
    return { rows: [], error: e instanceof Error ? e.message : "載入失敗", hasNextPage: false };
  }
}
