/**
 * 將各供應商／內部事件帶入的訂閱狀態字串，正規化為小寫 Stripe 相容語彙（工作區 SSOT）。
 * 未知值仍會小寫化後寫回，避免大小寫漂移。
 */
const KNOWN = new Set([
  "active",
  "trialing",
  "past_due",
  "unpaid",
  "canceled",
  "incomplete",
  "incomplete_expired",
  "paused",
]);

export function toCanonicalSubscriptionStatus(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const t = String(raw).trim().toLowerCase();
  if (t === "" || t === "null") return null;
  if (t === "cancelled") return "canceled";
  if (KNOWN.has(t)) return t;
  return t;
}
