# TelePlay backend

`server/index.mjs` is a framework-free Fetch handler for a D1/SQLite-compatible
database. It is intentionally separate from `dist/`: the application can switch
between the local and backend providers without changing game code.

## Runtime configuration

Provide these values as server-side secrets/environment variables:

```text
TELEGRAM_BOT_TOKEN=<BotFather token; never expose this to the browser>
OWNER_ID=1328706856
WEB_ORIGIN=https://turboplay-racing.llmim4yvn46ig.chatgpt.site
TELEPLAY_INIT_DATA_MAX_AGE=86400

# Payments remain disabled unless this JSON is explicitly configured.
# Amount is in the smallest unit of the selected currency; XTR is Telegram Stars.
TELEPLAY_PAYMENT_PACKAGES=[{"id":"gem-pack-small","name":"Small Pack","description":"100 TeleGems","gemsAmount":100,"amount":100,"currency":"XTR","provider":"telegram_stars","enabled":true}]
TELEPLAY_PAYMENT_WEBHOOK_SECRET=<random webhook secret>
# Required only for fiat currencies (Stars/XTR uses an empty provider token).
TELEGRAM_PAYMENT_PROVIDER_TOKEN=<BotFather payment provider token>
```

`TELEPLAY_OWNER_ID`/`TELEPLAY_OWNER_IDS` and `TELEPLAY_WEB_ORIGIN` remain
supported aliases. `DATABASE_URL` is reserved for a PostgreSQL deployment; the
included D1 implementation uses the `DB` binding instead.

## Supabase production target

The Supabase-ready assets are isolated under `supabase/` and reuse this same
API handler:

- `supabase/migrations/20260920051853_teleplay_backend_20260919.sql` creates the production
  PostgreSQL tables, indexes and server-only RLS boundary;
- `supabase/functions/teleplay-api/index.ts` is the Edge Function entrypoint;
- `server/postgres-db.mjs` adapts PostgreSQL to the handler's database contract.

In the TelePlay Supabase project, apply the migration and configure these Edge
Function secrets: `SUPABASE_DB_URL` (transaction pooler URI; `DATABASE_URL` is
also accepted for other runtimes),
`TELEGRAM_BOT_TOKEN`, `OWNER_ID=1328706856`, and the exact `WEB_ORIGIN`.
`SUPABASE_SERVICE_ROLE_KEY` is not required by the current direct PostgreSQL
adapter and must never be exposed to the browser. After deployment, use
`https://hmggjvnvrpijkbeojjgp.supabase.co/functions/v1/teleplay-api` as the
frontend `API_URL` and verify `/health` before switching `DATA_MODE` to
`backend`.

Bind the database as `DB`, apply `schema.sql`, and then apply files from
`migrations/` to older databases. The worker must be deployed behind HTTPS.
The frontend only receives public runtime values. Generate them during a
production build with:

```bash
DATA_MODE=backend API_URL=https://api.example.com \
  node scripts/generate-runtime-config.mjs
```

`dist/runtime-config.js` loads before the provider scripts. `BackendProvider`
then sends raw Telegram `initData` in `X-Telegram-Init-Data`. Keep
`ALLOW_LOCAL_FALLBACK=true` during rollout so an outage never destroys or hides
the device save.

## Security boundaries

- Every request that reads or mutates a player validates Telegram WebApp
  `initData` with the server-only bot token.
- `telegramId` comes from the verified payload, never from a client body.
- Owner endpoints resolve the allow-list on the server. The client role is only
  a display hint.
- The initial local-data import is one-way and only creates a missing profile;
  it cannot overwrite an existing server profile. Local currency, XP, records,
  achievements and inventory are not trusted during import.
- Normal state sync updates presentation state and verified inventory only.
  Progress, achievements, records, statistics and currency are server-owned.
- Currency writes are idempotent by transaction id and update the economy row
  with a compare-and-swap guard. Browser reward earns are rejected until a
  server-issued game-session/reward proof is implemented; owner grants use the
  authenticated `/admin/actions` endpoint.
- Shop spends are checked against the server-owned catalog (item, source,
  currency and price) and a purchase cannot be repeated for the same item.
- Game sessions accept only registered games, bounded scores/durations and
  timestamps; the session ID is scoped to its authenticated player.
- Admin mutations are applied by the server and written to `admin_actions`.

## Telegram Payments

`payments` is a server-only ledger. The browser can request a package and an
invoice link, but the package price and Gems amount are read from
`TELEPLAY_PAYMENT_PACKAGES`. The Edge Function calls Telegram `createInvoiceLink`,
answers `pre_checkout_query`, and credits Gems only after a matching
`successful_payment` webhook. `invoice_payload`, player ID, currency, amount,
charge ID and the idempotent `payment:<id>:gems` transaction must all match.

Configure Telegram to deliver updates to:

`https://hmggjvnvrpijkbeojjgp.supabase.co/functions/v1/teleplay-api/telegram/payments/webhook`

with the same `TELEPLAY_PAYMENT_WEBHOOK_SECRET` as Telegram's
`secret_token`. Keep packages absent/disabled in beta until BotFather/provider
configuration and live prices have been reviewed. Refund callbacks are recorded
as `refunded` and flagged for OWNER review; the service does not silently create
negative Gems balances.

## API

The handler implements the routes documented in `BACKEND_SCHEMA.md`, plus:

- `GET /health`
- `POST /players/me` — create the verified Telegram player with safe defaults
- `PUT /players/me/state` — sync non-currency player state
- `POST /players/me/import` — one-time migration of the local snapshot
- `POST /transactions` — authenticated idempotent currency operation
- `POST /game-sessions` — authenticated start/finish session upsert

The frontend remains usable without this service. If the API is unavailable,
it displays a friendly status and keeps using `LocalStorageProvider`; it never
clears local data automatically. Admin global lists and mutations are strict:
they do not silently present the current local player as server data.
