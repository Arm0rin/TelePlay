-- Telegram Payments foundation. Payment rows are internal to teleplay-api:
-- browser roles never get direct table access and Gems are only minted from a
-- verified successful_payment webhook.
create table if not exists public.payments (
  id text primary key,
  player_id text not null references public.players(telegram_id) on delete cascade,
  package_id text not null,
  invoice_id text not null unique,
  invoice_payload text not null unique,
  invoice_link text,
  payment_provider text not null,
  amount bigint not null check (amount > 0),
  currency text not null,
  status text not null check (status in ('pending', 'completed', 'failed', 'refunded')),
  gems_amount bigint not null check (gems_amount > 0),
  telegram_payment_charge_id text unique,
  provider_payment_charge_id text,
  idempotency_key text,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at bigint not null,
  completed_at bigint,
  updated_at bigint not null
);

create unique index if not exists idx_payments_player_idempotency
  on public.payments(player_id, idempotency_key)
  where idempotency_key is not null;
create index if not exists idx_payments_player_created
  on public.payments(player_id, created_at desc);
create index if not exists idx_payments_status_created
  on public.payments(status, created_at desc);
create index if not exists idx_payments_package
  on public.payments(package_id, created_at desc);

alter table public.payments enable row level security;
revoke all on table public.payments from anon, authenticated;
