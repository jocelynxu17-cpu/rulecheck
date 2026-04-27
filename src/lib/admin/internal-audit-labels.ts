import { INTERNAL_OPS_AUDIT_ACTIONS } from "@/lib/admin/internal-ops-audit";

const LABELS: Record<(typeof INTERNAL_OPS_AUDIT_ACTIONS)[number], string> = {
  workspace_repair: "工作區修復",
  workspace_quota_update: "工作區額度變更",
  workspace_plan_update: "工作區方案變更",
  workspace_subscription_status_update: "訂閱狀態變更",
  manual_billing_override: "手動帳務／Notify",
  user_password_recovery_request: "使用者密碼重設流程",
  user_password_recovery_force: "使用者密碼重設（強制再次觸發）",
  user_ban_update: "使用者帳號停用／啟用",
  user_quota_update: "使用者個人額度變更",
  user_plan_update: "使用者方案變更",
  user_subscription_status_update: "使用者訂閱狀態變更",
  user_period_end_update: "使用者計費週期結束日變更",
  user_cancel_at_period_end_update: "使用者週期末取消標記變更",
  user_billing_provider_update: "使用者帳務來源變更",
  user_manual_override: "使用者手動營運覆寫註記",
};

export function internalOpsAuditActionLabelZh(actionType: string): string {
  if (INTERNAL_OPS_AUDIT_ACTIONS.includes(actionType as (typeof INTERNAL_OPS_AUDIT_ACTIONS)[number])) {
    return LABELS[actionType as keyof typeof LABELS];
  }
  return actionType;
}
