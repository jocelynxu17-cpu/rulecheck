-- Soft-revoke invites + reject acceptance of revoked tokens

alter table public.workspace_invites
  add column if not exists revoked_at timestamptz;

create index if not exists workspace_invites_workspace_created_idx
  on public.workspace_invites (workspace_id, created_at desc);

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

  if inv.revoked_at is not null then
    return jsonb_build_object('ok', false, 'error', 'revoked');
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
