import type { ComponentProps } from "react";
import { Badge } from "@/components/ui/badge";
import { billingProviderLabelZh } from "@/lib/billing/subscription-state";
import {
  paymentEventOutcomeLabelZh,
  paymentEventOutcomeTone,
  providerBadgeTone,
  type PaymentBadgeTone,
} from "@/lib/admin/payment-event-ui";

type UiBadgeTone = NonNullable<ComponentProps<typeof Badge>["tone"]>;

const toneMap: Record<PaymentBadgeTone, UiBadgeTone> = {
  neutral: "neutral",
  blue: "blue",
  amber: "amber",
  red: "red",
  emerald: "emerald",
};

export function PaymentEventBadges({
  provider,
  eventType,
  compact = false,
}: {
  provider: string;
  eventType: string;
  compact?: boolean;
}) {
  const pLabel = billingProviderLabelZh(provider) ?? (provider || "—");
  const outcome = paymentEventOutcomeLabelZh(eventType);

  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${compact ? "" : "min-h-[1.5rem]"}`}>
      <Badge tone={toneMap[providerBadgeTone(provider)]} className="max-w-[140px] truncate text-[10px]">
        {pLabel}
      </Badge>
      <Badge tone={toneMap[paymentEventOutcomeTone(eventType)]} className="text-[10px]">
        {outcome}
      </Badge>
    </div>
  );
}

export function PaymentEventTypeBadge({ eventType }: { eventType: string }) {
  return (
    <span
      className="inline-flex max-w-[min(100%,22rem)] truncate rounded-md border border-surface-border bg-canvas/80 px-2 py-0.5 font-mono text-[10px] font-medium leading-tight text-ink"
      title={eventType}
    >
      {eventType}
    </span>
  );
}
