-- Workspaces, team membership, invites, shared unit quota, usage events

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references public.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  monthly_quota_units int not null default 5000,
  units_used_month int not null default 0,
  usage_month text not null default ''
);

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create index if not exists workspace_members_user_id_idx on public.workspace_members (user_id);

create table if not exists public.workspace_invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  email text not null,
  role text not null check (role in ('admin', 'member')),
  token text not null unique,
  invited_by uuid not null references public.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  accepted_at timestamptz
);

create index if not exists workspace_invites_workspace_idx on public.workspace_invites (workspace_id);

create table if not exists public.usage_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  input_type text not null check (input_type in ('text', 'image', 'pdf')),
  units_charged int not null check (units_charged >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists usage_events_workspace_created_idx on public.usage_events (workspace_id, created_at desc);
create index if not exists usage_events_user_created_idx on public.usage_events (user_id, created_at desc);

alter table public.analysis_logs
  add column if not exists workspace_id uuid references public.workspaces (id) on delete set null,
  add column if not exists input_type text,
  add column if not exists units_charged int,
  add column if not exists pdf_page_count int,
  add column if not exists analysis_batch_id uuid;

create index if not exists analysis_logs_workspace_id_idx on public.analysis_logs (workspace_id);

-- Backfill personal workspaces for existing users
insert into public.workspaces (name, created_by, monthly_quota_units, usage_month)
select
  '我的團隊',
  u.id,
  greatest(coalesce(u.monthly_analysis_quota, 30) * 50, 1500),
  coalesce(nullif(u.usage_month, ''), to_char(timezone('UTC', now()), 'YYYY-MM'))
from public.users u
where not exists (select 1 from public.workspace_members wm where wm.user_id = u.id);

insert into public.workspace_members (workspace_id, user_id, role)
select w.id, w.created_by, 'owner'
from public.workspaces w
where not exists (
  select 1 from public.workspace_members wm
  where wm.workspace_id = w.id and wm.user_id = w.created_by
);

update public.workspaces set usage_month = coalesce(nullif(usage_month, ''), to_char(timezone('UTC', now()), 'YYYY-MM')) where usage_month = '';

-- New user: default workspace
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

  insert into public.workspaces (name, created_by, monthly_quota_units, usage_month)
  values (
    '我的團隊',
    new.id,
    5000,
    to_char(timezone('UTC', now()), 'YYYY-MM')
  )
  returning id into wid;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (wid, new.id, 'owner');

  return new;
end;
$$;

-- Shared workspace unit consumption (article / page based)
create or replace function public.consume_workspace_units(
  p_workspace_id uuid,
  p_user_id uuid,
  p_units int,
  p_input_type text,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  w record;
  yymm text := to_char(timezone('UTC', now()), 'YYYY-MM');
  new_used int;
  remaining int;
  member_ok boolean;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;

  if p_units is null or p_units < 1 then
    return jsonb_build_object('ok', false, 'error', 'invalid_units');
  end if;

  select exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = p_workspace_id and wm.user_id = p_user_id
  ) into member_ok;

  if not member_ok then
    return jsonb_build_object('ok', false, 'error', 'not_member');
  end if;

  select * into w from public.workspaces where id = p_workspace_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'no_workspace');
  end if;

  if coalesce(w.usage_month, '') is distinct from yymm then
    update public.workspaces
      set usage_month = yymm, units_used_month = 0
      where id = p_workspace_id;
    w.usage_month := yymm;
    w.units_used_month := 0;
  end if;

  if w.units_used_month + p_units > w.monthly_quota_units then
    return jsonb_build_object(
      'ok', false,
      'error', 'quota_exceeded',
      'remaining', greatest(w.monthly_quota_units - w.units_used_month, 0),
      'quota', w.monthly_quota_units
    );
  end if;

  new_used := w.units_used_month + p_units;
  remaining := w.monthly_quota_units - new_used;

  update public.workspaces
    set units_used_month = new_used
  where id = p_workspace_id;

  insert into public.usage_events (workspace_id, user_id, input_type, units_charged, metadata)
  values (p_workspace_id, p_user_id, p_input_type, p_units, coalesce(p_metadata, '{}'::jsonb));

  return jsonb_build_object(
    'ok', true,
    'remaining', greatest(remaining, 0),
    'quota', w.monthly_quota_units,
    'used', new_used
  );
end;
$$;

grant execute on function public.consume_workspace_units(uuid, uuid, int, text, jsonb) to authenticated;

create or replace function public.accept_workspace_invite(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  inv public.workspace_invites%rowtype;
  uemail text;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'error', 'unauthorized');
  end if;

  select email into uemail from public.users where id = auth.uid();
  if uemail is null then
    return jsonb_build_object('ok', false, 'error', 'no_profile');
  end if;

  select * into inv
  from public.workspace_invites
  where token = p_token
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  if inv.accepted_at is not null then
    return jsonb_build_object('ok', false, 'error', 'already_accepted');
  end if;

  if inv.expires_at < now() then
    return jsonb_build_object('ok', false, 'error', 'expired');
  end if;

  if lower(trim(inv.email)) <> lower(trim(uemail)) then
    return jsonb_build_object('ok', false, 'error', 'email_mismatch');
  end if;

  if exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = inv.workspace_id and wm.user_id = auth.uid()
  ) then
    update public.workspace_invites set accepted_at = now() where id = inv.id;
    return jsonb_build_object('ok', true, 'workspace_id', inv.workspace_id, 'already_member', true);
  end if;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (inv.workspace_id, auth.uid(), inv.role);

  update public.workspace_invites set accepted_at = now() where id = inv.id;

  return jsonb_build_object('ok', true, 'workspace_id', inv.workspace_id);
end;
$$;

grant execute on function public.accept_workspace_invite(text) to authenticated;

-- RLS
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.workspace_invites enable row level security;
alter table public.usage_events enable row level security;

create policy "Members read workspace"
  on public.workspaces for select
  using (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = workspaces.id and wm.user_id = auth.uid()
    )
  );

create policy "Owners update workspace name and quota"
  on public.workspaces for update
  using (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = workspaces.id
        and wm.user_id = auth.uid()
        and wm.role = 'owner'
    )
  );

create policy "Members read membership"
  on public.workspace_members for select
  using (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = workspace_members.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "Admins manage membership insert"
  on public.workspace_members for insert
  with check (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = workspace_members.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner', 'admin')
    )
  );

create policy "Admins delete membership"
  on public.workspace_members for delete
  using (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = workspace_members.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner', 'admin')
    )
    and not (
      workspace_members.role = 'owner'
    )
  );

create policy "Admins read invites"
  on public.workspace_invites for select
  using (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = workspace_invites.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner', 'admin')
    )
  );

create policy "Admins insert invites"
  on public.workspace_invites for insert
  with check (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = workspace_invites.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner', 'admin')
    )
  );

create policy "Members read usage events"
  on public.usage_events for select
  using (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = usage_events.workspace_id
        and wm.user_id = auth.uid()
    )
  );

-- analysis_logs: replace policies
drop policy if exists "Users insert own analysis logs" on public.analysis_logs;
drop policy if exists "Users read own analysis logs" on public.analysis_logs;

create policy "Workspace or legacy read logs"
  on public.analysis_logs for select
  using (
    (
      workspace_id is not null
      and exists (
        select 1 from public.workspace_members wm
        where wm.workspace_id = analysis_logs.workspace_id
          and wm.user_id = auth.uid()
      )
    )
    or (
      workspace_id is null and user_id = auth.uid()
    )
  );

create policy "Members insert analysis logs"
  on public.analysis_logs for insert
  with check (
    user_id = auth.uid()
    and (
      (
        workspace_id is not null
        and exists (
          select 1 from public.workspace_members wm
          where wm.workspace_id = analysis_logs.workspace_id
            and wm.user_id = auth.uid()
        )
      )
      or workspace_id is null
    )
  );
