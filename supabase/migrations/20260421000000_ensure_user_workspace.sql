-- Runtime + batch recovery: users without workspace_members get a default workspace (SSOT for shared quota).

-- Idempotent backfill (safe to re-run): legacy rows with no membership
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
  u.id,
  greatest(coalesce(u.monthly_analysis_quota, 30) * 50, 1500),
  coalesce(nullif(u.usage_month, ''), to_char(timezone('UTC', now()), 'YYYY-MM')),
  coalesce(u.plan, 'free'),
  u.subscription_status,
  u.billing_provider,
  coalesce(u.cancel_at_period_end, false),
  u.current_period_end
from public.users u
where not exists (select 1 from public.workspace_members wm where wm.user_id = u.id);

insert into public.workspace_members (workspace_id, user_id, role)
select w.id, w.created_by, 'owner'
from public.workspaces w
where not exists (
  select 1 from public.workspace_members wm
  where wm.workspace_id = w.id and wm.user_id = w.created_by
);

-- Called by app when a session has no workspace_members row (trigger missed, migration order, etc.)
create or replace function public.ensure_user_workspace()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  wid uuid;
  u record;
  uemail text;
begin
  if uid is null then
    return jsonb_build_object('ok', false, 'error', 'unauthorized');
  end if;

  perform pg_advisory_xact_lock(hashtext(uid::text)::bigint);

  select wm.workspace_id into wid
  from public.workspace_members wm
  where wm.user_id = uid
  order by wm.workspace_id
  limit 1;

  if wid is not null then
    return jsonb_build_object('ok', true, 'created', false, 'workspace_id', wid);
  end if;

  select email into uemail from auth.users where id = uid;
  if uemail is null then
    return jsonb_build_object('ok', false, 'error', 'no_auth_user');
  end if;

  insert into public.users (id, email)
  values (uid, uemail)
  on conflict (id) do update set email = excluded.email;

  select * into u from public.users where id = uid;

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
  values (
    '我的團隊',
    uid,
    5000,
    to_char(timezone('UTC', now()), 'YYYY-MM'),
    coalesce(u.plan, 'free'),
    u.subscription_status,
    u.billing_provider,
    coalesce(u.cancel_at_period_end, false),
    u.current_period_end
  )
  returning id into wid;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (wid, uid, 'owner');

  return jsonb_build_object('ok', true, 'created', true, 'workspace_id', wid);
end;
$$;

grant execute on function public.ensure_user_workspace() to authenticated;
