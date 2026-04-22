/** Heuristic: Stripe / 金流事件類型是否可能代表失敗或需追蹤之異常（非完整 API Log）。 */
export function isLikelyPaymentFailureEventType(eventType: string): boolean {
  const t = eventType.toLowerCase();
  return (
    t.includes("failed") ||
    t.includes("error") ||
    t.includes("declined") ||
    t.includes("dispute") ||
    t.includes("refund")
  );
}

/** Legacy notify 或 v1 payload 含 billing_state 之帳務寫入跡象（與內部總覽／安全頁一致）。 */
export function isNotifyLikePaymentEvent(row: {
  event_type: string;
  payload: Record<string, unknown> | null;
}): boolean {
  const t = row.event_type.toLowerCase();
  if (t.startsWith("notify")) return true;
  const p = row.payload;
  return Boolean(p && typeof p === "object" && "billing_state" in p);
}
