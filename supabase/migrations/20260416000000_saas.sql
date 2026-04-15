-- SaaS: 配額、Stripe 欄位、RPC 扣點

alter table public.users
  add column if not exists display_name text,
  add column if not exists plan text not null default 'free',
  add column if not exists monthly_analysis_quota int not null default 30,
  add column if not exists analyses_used_month int not null default 0,
  add column if not exists usage_month text not null default '',
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists subscription_status text;

-- 已存在資料列補齊 usage_month，避免首次比對異常
update public.users set usage_month = coalesce(nullif(usage_month, ''), to_char(now(), 'YYYY-MM')) where usage_month = '';

create or replace function public.consume_analysis_credit(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  u record;
  yymm text := to_char(timezone('UTC', now()), 'YYYY-MM');
  new_used int;
  remaining int;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;

  select * into u from public.users where id = p_user_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'no_profile');
  end if;

  if coalesce(u.usage_month, '') is distinct from yymm then
    update public.users
      set usage_month = yymm, analyses_used_month = 0
      where id = p_user_id;
    u.usage_month := yymm;
    u.analyses_used_month := 0;
  end if;

  if u.analyses_used_month >= u.monthly_analysis_quota then
    return jsonb_build_object(
      'ok', false,
      'error', 'quota_exceeded',
      'remaining', 0,
      'quota', u.monthly_analysis_quota
    );
  end if;

  new_used := u.analyses_used_month + 1;
  remaining := u.monthly_analysis_quota - new_used;

  update public.users
    set analyses_used_month = new_used
  where id = p_user_id;

  return jsonb_build_object(
    'ok', true,
    'remaining', greatest(remaining, 0),
    'quota', u.monthly_analysis_quota,
    'used', new_used
  );
end;
$$;

grant execute on function public.consume_analysis_credit(uuid) to authenticated;
