import { INTERNAL_OPS_AUDIT_ACTIONS } from "@/lib/admin/internal-ops-audit";

const LABELS: Record<(typeof INTERNAL_OPS_AUDIT_ACTIONS)[number], string> = {
  workspace_repair: "工作區修復",
  workspace_quota_update: "工作區額度變更",
  workspace_plan_update: "工作區方案變更",
  workspace_subscription_status_update: "訂閱狀態變更",
  manual_billing_override: "手動帳務／Notify",
};

export function internalOpsAuditActionLabelZh(actionType: string): string {
  if (INTERNAL_OPS_AUDIT_ACTIONS.includes(actionType as (typeof INTERNAL_OPS_AUDIT_ACTIONS)[number])) {
    return LABELS[actionType as keyof typeof LABELS];
  }
  return actionType;
}
