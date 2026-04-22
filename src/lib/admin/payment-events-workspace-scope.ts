import type { AdminPaymentEventDetail } from "@/lib/admin/load-payment-events";

export function payloadWorkspaceIdFromPaymentPayload(p: Record<string, unknown>): string | null {
  const v = p.workspace_id;
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

export function filterPaymentEventsForWorkspace(
  rows: AdminPaymentEventDetail[],
  workspaceId: string,
  memberUserIds: Set<string>
): AdminPaymentEventDetail[] {
  return rows.filter((ev) => {
    const wid = payloadWorkspaceIdFromPaymentPayload(ev.payload);
    if (wid === workspaceId) return true;
    if (ev.user_id && memberUserIds.has(ev.user_id)) return true;
    return false;
  });
}
