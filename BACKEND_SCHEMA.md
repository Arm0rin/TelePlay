# TelePlay global data contract

The build selects a provider through `dist/runtime-config.js`. `DATA_MODE=local` uses `LocalStorageProvider`; `DATA_MODE=backend` uses `BackendProvider` after a successful health/auth/player initialization flow. The game modules do not change. Generate the public configuration with `scripts/generate-runtime-config.mjs`. A D1/SQLite-compatible Fetch API implementation is provided in `server/index.mjs`; apply `server/schema.sql` before connecting it and apply `server/migrations/` to an existing database.

## Identity and security

The client sends the raw `Telegram.WebApp.initData` in `X-Telegram-Init-Data`. The server must validate the Telegram Web App hash, timestamp/expiry and `user.id` on every authenticated request. `telegramId` is the immutable player key; username is display data only. Admin requests must additionally resolve the role from a server-side allow-list and check the requested permission. Never trust balances, XP, role or `targetPlayer` from the browser.

## API routes

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Verify API and database readiness without Telegram authentication. |
| `GET` | `/players/me` | Load the authenticated player; response `{ player }`. |
| `POST` | `/players/me` | Create a missing authenticated player with safe defaults. |
| `POST` | `/players/me/import` | One-time localStorage migration of identity/presentation state; authoritative economy and progress start from server defaults and never overwrite an existing profile. |
| `PUT` | `/players/me/state` | Sync presentation state and server-verified inventory; cannot change economy, progression, achievements, records or statistics. |
| `PUT` | `/players/:telegramId` | Backward-compatible identity-checked initial import; existing profiles are never overwritten. |
| `GET` | `/players?q=&filter=&sort=` | OWNER player list with `new`, `active`, `level` and `played` filters; response `{ players }`. |
| `GET` | `/players/:telegramId` | OWNER player detail. |
| `GET` | `/transactions?playerId=` | Typed global currency history; response `{ transactions }`. |
| `POST` | `/transactions` | Authenticated, idempotent currency operation; server updates the economy row and transaction ledger. |
| `POST` | `/game-sessions` | Upsert an authenticated player's game start/finish session. The player id is taken from verified Telegram data. |
| `GET` | `/game-sessions?playerId=` | OWNER session history for analytics/admin views. |
| `POST` | `/analytics/events` | Append a validated player event; response `{ event }`. |
| `GET` | `/analytics/events?playerId=` | OWNER event viewer; response `{ events }`. |
| `POST` | `/admin/actions` | OWNER mutation endpoint; validate permission, idempotency and target server-side. |
| `GET` | `/admin/actions?playerId=` | OWNER audit log; response `{ actions }`. |

## Tables

`PlayerModel.schema` is the source-of-truth field contract used by the frontend adapter:

- `Players`: Telegram identity, timestamps, progress, economy, inventory and statistics;
- `Transactions`: `id`, `playerId`, `currency`, `type`, `amount`, `source`, `metadata`, `createdAt`;
- `GameSessions`: `id`, `playerId`, `gameId`, start/finish timestamps, score and result;
- `AnalyticsEvents`: `id`, `playerId`, `event`, `timestamp`, `metadata`;
- `Inventory`: player, scope, item, slot, equipped state and update timestamp;
- `AdminActions`: admin identity/role, action, target, amount, reason and timestamp.

All write endpoints should be idempotent on the supplied transaction/event/action ID. The local provider remains the offline fallback when the API is unavailable. A pending local state is retried after the next healthy startup. The server rejects client-supplied identities, prevents state sync from changing authoritative fields, validates equipped items against the server catalog, and never accepts a full economy overwrite after import. Browser reward earns are rejected until server-issued session/reward proofs exist; rejected reward writes are discarded client-side rather than retried forever.

## Deployment boundary

The published Site is static and therefore does not provide a database binding. The production target is the TelePlay Supabase project (`hmggjvnvrpijkbeojjgp`): apply `supabase/migrations/20260920051853_teleplay_backend_20260919.sql`, deploy `supabase/functions/teleplay-api`, add the server-only secrets, and verify the function `/health` endpoint. The deployed API URL is `https://hmggjvnvrpijkbeojjgp.supabase.co/functions/v1/teleplay-api`; build the Site with `DATA_MODE=backend` and that HTTPS `API_URL`. A D1 binding remains supported for local/alternative deployments. `ALLOW_LOCAL_FALLBACK=true` keeps device saves available while the secrets or API are being configured.
