# TelePlay API Edge Function

This function uses Telegram `initData` as its application authentication and
therefore has `verify_jwt = false`. The shared handler verifies the Telegram
signature before player or admin data is read.

Required custom Edge Function secrets:

- `TELEGRAM_BOT_TOKEN`: the bot token used to validate Telegram initData.
- `OWNER_ID`: Telegram numeric ID allowed to use admin endpoints (`1328706856`).
- `WEB_ORIGIN`: the exact hosted frontend origin.

Hosted Supabase Edge Functions provide `SUPABASE_DB_URL` automatically. The
handler also accepts `DATABASE_URL` for local or non-Supabase runtimes.

The `server/` files are the deployable copies of the shared Node-compatible
handler and Postgres adapter. Keep them synchronized with the root `server/`
files when changing API behavior.
