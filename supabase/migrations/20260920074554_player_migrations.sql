create table if not exists public.player_migrations (
  id text primary key,
  player_id text not null references public.players(telegram_id) on delete cascade,
  migration_version text not null,
  source text not null,
  completed_at bigint not null,
  metadata_json jsonb not null default '{}'::jsonb,
  unique (player_id, migration_version)
);

create index if not exists idx_player_migrations_player
  on public.player_migrations (player_id, completed_at desc);

revoke all on table public.player_migrations from anon, authenticated;
