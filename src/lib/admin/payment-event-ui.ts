export type PaymentBadgeTone = "neutral" | "blue" | "amber" | "red" | "emerald";

export function providerBadgeTone(provider: string | null | undefined): PaymentBadgeTone {
  const p = (provider ?? "").toLowerCase();
  if (p === "stripe" || p === "newebpay") return "blue";
  return "neutral";
}

export function paymentEventOutcomeTone(eventType: string | null | undefined): PaymentBadgeTone {
  const t = (eventType ?? "").toLowerCase();
  if (
    /failed|declined|dispute|refund_reversed|invalid|unpaid|past_due|fraud|blocked/.test(t) ||
    /charge\.(failed|expired)/.test(t)
  ) {
    return "red";
  }
  if (/error|requires_action|action_required|async_payment_pending|processing|pending/.test(t)) {
    return "amber";
  }
  if (
    /succeeded|invoice\.paid|payment_intent\.succeeded|charge\.succeeded|checkout\.session\.completed|charge\.captured/.test(
      t
    )
  ) {
    return "emerald";
  }
  return "neutral";
}

export function paymentEventOutcomeLabelZh(eventType: string | null | undefined): string {
  const tone = paymentEventOutcomeTone(eventType);
  if (tone === "emerald") return "成功／完成";
  if (tone === "red") return "失敗／風險";
  if (tone === "amber") return "留意";
  return "一般紀錄";
}
