-- Enforce idempotency_key presence for payment_events (DB-level dedupe already via UNIQUE).

update public.payment_events
set idempotency_key = 'legacy:' || id::text
where idempotency_key is null;

alter table public.payment_events
  alter column idempotency_key set not null;
