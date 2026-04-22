-- Allow workspace owners/admins to update (resend) and delete (cancel) pending invites.

create policy "Admins update invites"
  on public.workspace_invites for update
  using (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = workspace_invites.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner', 'admin')
    )
  )
  with check (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = workspace_invites.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner', 'admin')
    )
  );

create policy "Admins delete invites"
  on public.workspace_invites for delete
  using (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = workspace_invites.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner', 'admin')
    )
  );
