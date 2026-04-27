-- Extend internal_ops_audit_log for user-scoped admin actions (user detail / auth / billing snapshot).

alter table public.internal_ops_audit_log drop constraint if exists internal_ops_audit_log_action_type_check;

alter table public.internal_ops_audit_log add constraint internal_ops_audit_log_action_type_check check (
  action_type in (
    'workspace_repair',
    'workspace_quota_update',
    'workspace_plan_update',
    'workspace_subscription_status_update',
    'manual_billing_override',
    'user_password_recovery_request',
    'user_password_recovery_force',
    'user_ban_update',
    'user_quota_update',
    'user_plan_update',
    'user_subscription_status_update',
    'user_period_end_update',
    'user_cancel_at_period_end_update',
    'user_billing_provider_update',
    'user_manual_override'
  )
);

alter table public.internal_ops_audit_log drop constraint if exists internal_ops_audit_log_target_type_check;

alter table public.internal_ops_audit_log add constraint internal_ops_audit_log_target_type_check check (
  target_type in ('workspace', 'system', 'billing', 'user')
);
