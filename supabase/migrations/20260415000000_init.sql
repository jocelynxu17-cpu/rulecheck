-- Taiwan ad compliance MVP — public.users + analysis_logs
-- Run in Supabase SQL Editor or: supabase db push

-- Mirror auth user for FK from analysis_logs (optional profile fields later)
create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  created_at timestamptz not null default now()
);

alter table public.users enable row level security;

create policy "Users can read own row"
  on public.users for select
  using (auth.uid() = id);

-- Log each analysis (input + JSON result)
create table if not exists public.analysis_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  input_text text not null,
  result jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists analysis_logs_user_id_created_at_idx
  on public.analysis_logs (user_id, created_at desc);

alter table public.analysis_logs enable row level security;

create policy "Users insert own analysis logs"
  on public.analysis_logs for insert
  with check (auth.uid() = user_id);

create policy "Users read own analysis logs"
  on public.analysis_logs for select
  using (auth.uid() = user_id);

-- Sync row when someone signs up (Dashboard FK)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email)
  values (new.id, new.email)
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Backfill existing auth users (optional, safe to re-run)
insert into public.users (id, email)
select id, email from auth.users
on conflict (id) do update set email = excluded.email;
