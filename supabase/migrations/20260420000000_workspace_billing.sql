-- Workspace as billing / plan source of truth (UI + future webhooks)

alter table public.workspaces
  add column if not exists plan text not null default 'free',
  add column if not exists subscription_status text,
  add column if not exists billing_provider text,
  add column if not exists cancel_at_period_end boolean not null default false,
  add column if not exists current_period_end timestamptz;

update public.workspaces w
set
  plan = coalesce(u.plan, w.plan),
  subscription_status = coalesce(u.subscription_status, w.subscription_status),
  billing_provider = coalesce(u.billing_provider, w.billing_provider),
  cancel_at_period_end = coalesce(u.cancel_at_period_end, w.cancel_at_period_end),
  current_period_end = coalesce(u.current_period_end, w.current_period_end)
from public.users u
where u.id = w.created_by;
