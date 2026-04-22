import { createAdminClient } from "@/lib/supabase/admin";
import { filterPaymentEventsForWorkspace } from "@/lib/admin/payment-events-workspace-scope";

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

export async function loadPaymentEvents(limit = 200): Promise<{
  rows: AdminPaymentEventDetail[];
  error: string | null;
}> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { rows: [], error: "未設定 SUPABASE_SERVICE_ROLE_KEY。" };
  }

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
      .limit(limit);

    if (error) {
      return { rows: [], error: error.message };
    }

    const rows: AdminPaymentEventDetail[] = (data ?? []).map((row: Record<string, unknown>) => {
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

    return { rows, error: null };
  } catch (e) {
    return { rows: [], error: e instanceof Error ? e.message : "載入失敗" };
  }
}

/** 依 workspace_id（payload）或成員 user_id 篩選；先拉取較多筆再過濾。 */
export async function loadPaymentEventsForWorkspace(
  workspaceId: string,
  fetchLimit = 500
): Promise<{ rows: AdminPaymentEventDetail[]; error: string | null }> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { rows: [], error: "未設定 SUPABASE_SERVICE_ROLE_KEY。" };
  }

  try {
    const admin = createAdminClient();

    const { data: memRows, error: memErr } = await admin
      .from("workspace_members")
      .select("user_id")
      .eq("workspace_id", workspaceId);

    if (memErr) {
      return { rows: [], error: memErr.message };
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
      return { rows: [], error: error.message };
    }

    const rows: AdminPaymentEventDetail[] = (data ?? []).map((row: Record<string, unknown>) => {
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

    const filtered = filterPaymentEventsForWorkspace(rows, workspaceId, memberIds);
    return { rows: filtered, error: null };
  } catch (e) {
    return { rows: [], error: e instanceof Error ? e.message : "載入失敗" };
  }
}
