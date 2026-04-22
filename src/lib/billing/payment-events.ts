import type { SupabaseClient } from "@supabase/supabase-js";

export type RecordPaymentEventInput = {
  userId: string | null;
  subscriptionId: string | null;
  provider: string;
  eventType: string;
  idempotencyKey: string;
  payload?: Record<string, unknown>;
};

/**
 * Inserts a payment_events row when idempotency_key is new.
 * Safe for webhook retries: duplicate keys return inserted=false without error.
 */
export async function recordPaymentEventIfNew(
  admin: SupabaseClient,
  input: RecordPaymentEventInput
): Promise<{ ok: true; inserted: boolean; id?: string } | { ok: false; error: string }> {
  const { data: existing } = await admin
    .from("payment_events")
    .select("id")
    .eq("idempotency_key", input.idempotencyKey)
    .maybeSingle();

  if (existing?.id) {
    return { ok: true, inserted: false, id: existing.id };
  }

  const { data, error } = await admin
    .from("payment_events")
    .insert({
      user_id: input.userId,
      subscription_id: input.subscriptionId,
      provider: input.provider,
      event_type: input.eventType,
      idempotency_key: input.idempotencyKey,
      payload: input.payload ?? {},
    })
    .select("id")
    .maybeSingle();

  if (error) {
    if (error.code === "23505") {
      return { ok: true, inserted: false };
    }
    return { ok: false, error: error.message };
  }

  return { ok: true, inserted: true, id: data?.id };
}
