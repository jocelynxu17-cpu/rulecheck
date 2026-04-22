-- Internal operations audit trail (service-role writes only; not exposed via PostgREST anon policies)

create table if not exists public.internal_ops_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.users (id) on delete set null,
  actor_email text,
  action_type text not null check (
    action_type in (
      'workspace_repair',
      'workspace_quota_update',
      'workspace_plan_update',
      'workspace_subscription_status_update',
      'manual_billing_override'
    )
  ),
  target_type text not null check (target_type in ('workspace', 'system', 'billing')),
  target_id text,
  before_json jsonb not null default '{}'::jsonb,
  after_json jsonb not null default '{}'::jsonb,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists internal_ops_audit_log_created_at_idx
  on public.internal_ops_audit_log (created_at desc);

create index if not exists internal_ops_audit_log_action_type_idx
  on public.internal_ops_audit_log (action_type);

create index if not exists internal_ops_audit_log_actor_idx
  on public.internal_ops_audit_log (actor_user_id);

alter table public.internal_ops_audit_log enable row level security;

-- No policies: authenticated/anon cannot read or write. Server uses service role (bypasses RLS).

comment on table public.internal_ops_audit_log is 'Sensitive internal/admin actions for accountability (written via service role only).';
