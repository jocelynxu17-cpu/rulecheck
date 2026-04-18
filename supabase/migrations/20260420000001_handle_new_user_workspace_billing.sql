-- New user: default workspace carries billing snapshot from public.users (SSOT on workspace for UI)

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  wid uuid;
begin
  insert into public.users (id, email)
  values (new.id, new.email)
  on conflict (id) do update set email = excluded.email;

  if exists (select 1 from public.workspace_members where user_id = new.id) then
    return new;
  end if;

  insert into public.workspaces (
    name,
    created_by,
    monthly_quota_units,
    usage_month,
    plan,
    subscription_status,
    billing_provider,
    cancel_at_period_end,
    current_period_end
  )
  select
    '我的團隊',
    new.id,
    5000,
    to_char(timezone('UTC', now()), 'YYYY-MM'),
    u.plan,
    u.subscription_status,
    u.billing_provider,
    u.cancel_at_period_end,
    u.current_period_end
  from public.users u
  where u.id = new.id
  returning id into wid;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (wid, new.id, 'owner');

  return new;
end;
$$;
