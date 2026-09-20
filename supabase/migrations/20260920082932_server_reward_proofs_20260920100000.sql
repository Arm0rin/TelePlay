-- Server Reward Proofs: immutable game results, one proof per session, and
-- security telemetry.  These tables are internal to the Edge Function; the
-- browser never receives direct Data API grants.

create table if not exists public.game_results (
  id text primary key,
  player_id text not null references public.players(telegram_id) on delete cascade,
  game_id text not null,
  session_id text not null unique references public.game_sessions(id) on delete cascade,
  score bigint not null default 0,
  duration bigint not null default 0,
  metadata_json text not null default '{}',
  validated boolean not null default false,
  rejection_code text,
  reward_proof_id text unique,
  created_at bigint not null
);

create table if not exists public.reward_proofs (
  id text primary key,
  player_id text not null references public.players(telegram_id) on delete cascade,
  game_id text not null,
  session_id text not null unique references public.game_sessions(id) on delete cascade,
  reward_data_json text not null default '{}',
  status text not null check (status in ('pending', 'processing', 'issued', 'rejected', 'failed')),
  created_at bigint not null,
  updated_at bigint not null
);

create table if not exists public.fraud_events (
  id text primary key,
  player_id text not null references public.players(telegram_id) on delete cascade,
  game_id text,
  session_id text,
  type text not null,
  metadata_json text not null default '{}',
  created_at bigint not null
);

create index if not exists idx_game_results_player on public.game_results(player_id, created_at desc);
create index if not exists idx_game_results_validation on public.game_results(validated, created_at desc);
create index if not exists idx_reward_proofs_player on public.reward_proofs(player_id, created_at desc);
create index if not exists idx_reward_proofs_status on public.reward_proofs(status, created_at desc);
create index if not exists idx_fraud_events_player on public.fraud_events(player_id, created_at desc);
create index if not exists idx_fraud_events_created on public.fraud_events(created_at desc);

alter table public.game_results enable row level security;
alter table public.reward_proofs enable row level security;
alter table public.fraud_events enable row level security;
revoke all on table public.game_results, public.reward_proofs, public.fraud_events from anon, authenticated;
