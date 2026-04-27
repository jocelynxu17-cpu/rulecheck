-- O(1) aggregation for internal home dashboard (avoid fetching all workspace rows).

create or replace function public.admin_sum_workspace_units_for_month(p_usage_month text)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(units_used_month), 0)::bigint
  from public.workspaces
  where usage_month is not null
    and trim(usage_month) <> ''
    and usage_month = trim(p_usage_month);
$$;

revoke all on function public.admin_sum_workspace_units_for_month(text) from public;
grant execute on function public.admin_sum_workspace_units_for_month(text) to service_role;

comment on function public.admin_sum_workspace_units_for_month(text) is 'Internal dashboard: sum workspace units_used_month for a YYYY-MM usage_month (service_role only).';
