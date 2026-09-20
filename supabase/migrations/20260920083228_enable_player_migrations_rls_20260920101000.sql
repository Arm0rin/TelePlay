-- player_migrations is read and written only through teleplay-api's direct
-- database connection. Keep it out of the browser-facing Data API.
alter table public.player_migrations enable row level security;
revoke all on table public.player_migrations from anon, authenticated;
