-- Billing: subscriptions / payment_events + user-facing billing snapshot fields (NewebPay-ready)

alter table public.users
  add column if not exists billing_provider text,
  add column if not exists cancel_at_period_end boolean not null default false,
  add column if not exists current_period_end timestamptz;

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  provider text not null,
  status text not null,
  plan text not null default 'pro',
  external_subscription_id text,
  cancel_at_period_end boolean not null default false,
  current_period_start timestamptz,
  current_period_end timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists subscriptions_user_id_idx on public.subscriptions (user_id);
create index if not exists subscriptions_external_idx on public.subscriptions (external_subscription_id);

create table if not exists public.payment_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users (id) on delete set null,
  subscription_id uuid references public.subscriptions (id) on delete set null,
  provider text not null,
  event_type text not null,
  idempotency_key text unique,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists payment_events_user_id_idx on public.payment_events (user_id);
create index if not exists payment_events_subscription_id_idx on public.payment_events (subscription_id);

alter table public.subscriptions enable row level security;
alter table public.payment_events enable row level security;

create policy "Users read own subscriptions"
  on public.subscriptions for select
  using (auth.uid() = user_id);

create policy "Users read own payment events"
  on public.payment_events for select
  using (auth.uid() = user_id);
