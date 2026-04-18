-- Allow admins (not only owners) to update shared workspace quota / name
drop policy if exists "Owners update workspace name and quota" on public.workspaces;

create policy "Owner admin update workspace"
  on public.workspaces for update
  using (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = workspaces.id
        and wm.user_id = auth.uid()
        and wm.role in ('owner', 'admin')
    )
  );
