/** 帳務事件 payload 單行摘要（避免整段 JSON 噪音）。 */
export function summarizePaymentPayload(payload: Record<string, unknown> | null | undefined): string {
  if (!payload || typeof payload !== "object") {
    return "—";
  }

  const stripeEventId = payload.stripe_event_id;
  const type = payload.type;

  if (typeof stripeEventId === "string" && typeof type === "string") {
    const shortId = stripeEventId.length > 22 ? `${stripeEventId.slice(0, 22)}…` : stripeEventId;
    return `Stripe · ${type} · ${shortId}`;
  }

  if (typeof stripeEventId === "string") {
    const shortId = stripeEventId.length > 28 ? `${stripeEventId.slice(0, 28)}…` : stripeEventId;
    return `Stripe 事件 · ${shortId}`;
  }

  if (typeof type === "string") {
    return `類型欄位：${type}`;
  }

  const keys = Object.keys(payload).filter((k) => k !== "object" && k !== "data").slice(0, 5);
  if (keys.length === 0) {
    return "（無欄位）";
  }
  return `欄位：${keys.join("、")}`;
}
