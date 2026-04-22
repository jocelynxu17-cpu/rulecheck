-- Any workspace member can read invites (visibility); mutations remain owner/admin-only via existing policies.

create policy "Members read invites in workspace"
  on public.workspace_invites for select
  using (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = workspace_invites.workspace_id
        and wm.user_id = auth.uid()
    )
  );
