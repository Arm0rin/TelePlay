# TelePlay architecture

## Structure

- `dist/app.js` — catalog routing and platform shell only.
- `dist/games.js` — Game Registry. Every entry has `id`, `title`, `category`, `status`, `component` and `engineType`.
- `dist/game-shell.js` — compatibility facade for records, coins, Result Screen and sounds; legacy game events are bridged into `GameSession`.
- `dist/core/` — scalable platform services: `GameSession`, `PlayerData`, `SaveManager`, `CurrencyManager`, `RewardManager`, `Analytics`, `AudioManager`, `HapticManager`.
- `dist/core/telegram-auth.js` — Telegram identity and raw `initData` header helper.
- `dist/core/player-model.js` — canonical global Player record and database table contract.
- `dist/core/data-provider.js` — switchable `LocalStorageProvider` / `BackendProvider`; `DataProvider` is the only data transport boundary.
- `dist/runtime-config.js` — public `DATA_MODE`, `API_URL`, fallback and timeout values loaded before the data layer; generated from environment variables by `scripts/generate-runtime-config.mjs`.
- `server/index.mjs` — D1/SQLite-compatible HTTPS API handler with Telegram initData verification, one-time local import, player/transaction/event/admin routes and server-side owner checks.
- `server/schema.sql` — normalized Players, Progress, Economy, Inventory, Transactions, GameSessions, AnalyticsEvents and AdminActions tables with indexes.
- `supabase/` — PostgreSQL migration and Edge Function production entrypoint for the TelePlay Supabase organization; it reuses the same API contract through `server/postgres-db.mjs`.
- `server/README.md` — runtime secrets, deployment and security boundary instructions.
- `BACKEND_SCHEMA.md` — backend API, table and server-validation contract.
- `dist/core/shop/` — split cosmetic economy: TelePlay profile catalog, `ShopManager` and the generic `GameShop` engine. Profile items never share a catalog with game items. `TelePlayShopConfig.GEM_PACKAGES` is payment-ready catalog data only; checkout is intentionally not implemented.
- `dist/core/player/` — Player Core: profile identity, scalable XP, ranks, genre mastery, titles, global statistics, achievement definitions and the cross-game Daily/Weekly Challenge system.
- `dist/game-adapters/` — adapters for Canvas, Puzzle and Sports modules.
- `dist/arcade-engine/` — shared Canvas foundation: loop, input, camera, state, particles, collision, score and entity.
- `dist/games/penalty-duel/sports-engine/` — reusable shot-game foundation: trajectory, ball physics and collision helpers.
- `dist/games/<id>/` — isolated game modules and configuration. Neon Race is now in `dist/games/neon-race/`.
- `dist/games/template/` — starter module and README for future games.
- `dist/admin/` — restricted OWNER workspace: Telegram-ID/username guard, owner actions, local dashboards, shop/economy views and audit logs. The launcher is injected only after the auth check; ordinary users do not receive an Admin Panel button.

## Game lifecycle

Games expose `init`, `start`, `pause`, `resume`, `restart` and `destroy`. An adapter connects that module to `GameSession`, so the platform does not know the game's internal mechanics. A normal session is:

`GameSession.startGame()` → game module → `RewardManager` → `CurrencyManager` → `SaveManager` → Result Screen → `GameSession.handleEvent('game_finished')` → `Analytics`. `GameSession.finishGame()` is lifecycle-only and never grants currency.

## Player data and saves

`PlayerData` is the single data API. `SaveManager` stores the versioned `teleplay-player-data` document with `saveVersion: 7` and `playerVersion: 2`. The migration imports legacy `economy.coins`/`turbo-coins` once, maps legacy `teleGems` to canonical `gems` (default `0`), normalizes transaction currency types, preserves records, Neon Race garage data and GameShell records, and then keeps only the canonical top-level `coins` and `gems` fields. Player Core adds profile identity, `progress`, `mastery`, `titles`, `statistics`, `activity`, `favoriteGameId`, `settings`, achievement unlocks, `progression.challenges` and `currencyTransactions` without creating a second storage layer. Version 7 also initializes bounded `analyticsEvents` and `adminActionLog` arrays for the owner audit trail. `DataProvider` keeps synchronous game reads compatible through a local cache while backend mode hydrates and synchronizes that cache with the verified server player.

The global Player record is keyed by immutable `telegramId`; username is never used as the primary key. `PlayerModel.toRecord()` maps the local document into profile, progress, economy, inventory and statistics, and `fromRecord()` hydrates a local-compatible snapshot. `LocalStorageProvider` preserves offline behavior and current saves. In backend mode startup performs `/health`, validates Telegram identity through `/players/me`, loads an existing player or creates a safe default via `POST /players/me`. If a missing server player has meaningful local progress, the user explicitly chooses import or local continuation; the server never overwrites an existing account with that import. State sync uses `PUT /players/me/state`, while typed currency operations remain isolated at `/transactions`. API/network/auth/save failures produce friendly UI status, retain the device snapshot and can be retried. Admin global reads and mutations remain strict and never masquerade local data as global data.

Backend mode is enabled at build/deploy time with `DATA_MODE=backend API_URL=https://… node scripts/generate-runtime-config.mjs`. The committed default is `local`, so a static deployment without an API remains playable. Server secrets (`TELEGRAM_BOT_TOKEN`, database credentials/binding and OWNER allow-list) never enter `dist/`.

The player lifecycle is fed by common GameShell/Analytics events. `GameSession.handleEvent()` is the single event bridge: it forwards events to `PlayerData`, dispatches the `teleplay:*` event and tracks active sessions. `game_started` updates launch counts, last-played, daily first-launch XP and the canonical daily streak; `game_finished` awards result, combo and victory XP; `new_record` and perfect-action events add skill XP. Every start and finish also adds XP to the mapped Racing, Arcade, Puzzle or Sports mastery. Level requirements are calculated from `50 × level^1.4` and stop at level 100; ranks, titles and achievement rewards are calculated from the same saved player state.

The cosmetic economy is stored in the same `PlayerData` document as a split `inventory`: `inventory.profile` contains account items, while `inventory.games[gameId]` contains only that game's owned/equipped items and purchase history. `SaveManager` migrates the former flat inventory by item-id prefix and keeps `saveVersion: 7`. `TelePlayShopConfig` exposes profile items, including the test-only `Premium Collection` priced in Gems. `dist/core/shop/game-shop.js` defines the generic `GameShop` interface (`getItems`, `buyItem`, `equipItem`, `getOwnedItems`, `getCategories`), and each game registers its own catalog from `dist/games/<id>/shop/shop.js`. `ShopManager` is the single purchase boundary: it calls `RewardManager.spend()`, which calls `CurrencyManager.spendCoins()` or `CurrencyManager.spendGems()` according to the item price, then persists ownership through `PlayerData`/`SaveManager`; purchases/equipment emit `item_purchased` and `item_equipped`, while the shop UI emits `item_viewed`, `game_shop_opened`, `shop_opened`, `collection_opened` and premium-item events. The legacy Neon Race garage uses `ShopManager.charge()` as well, so it does not bypass the currency core. Profile and game inventories have separate collection/equipment APIs and idempotent transaction IDs. Items only expose visual values (`visualData`, `slot`, `gameId`), so no cosmetic can alter gameplay stats. Renderers opt into equipped visuals through `TelePlayShop.visualForGame()`; the profile avatar uses the equipped frame.

## Rewards and analytics

Games report a result; `RewardManager` delegates TeleCoins/TeleGems to `CurrencyManager`, which updates the canonical `PlayerData.coins`/`PlayerData.gems`, appends a typed transaction and persists through `SaveManager`. `CurrencyManager` is the single emitter for `coins_earned`, `coins_spent`, `gems_received` and `gems_spent`, and transaction IDs make repeated rewards or purchases idempotent. `Analytics` provides common events: `game_opened`, `game_started`, `game_finished`, `game_restarted`, `game_paused`, `new_record`, `coins_earned` and `level_completed`.

`dist/core/player/challenges.js` creates three Daily Challenges and three Weekly Missions, resets them by UTC day/week, tracks progress from common gameplay events and sends every XP/Coin reward through `RewardManager`. The same module owns the daily streak (`currentStreak`, `bestStreak`, `lastActiveDate`) and configurable 3/7/30-day bonuses. The Challenges screen is opened from Profile, keeping Home Dashboard compact. Challenge analytics include `daily_opened`, `challenge_started`, `challenge_completed`, `weekly_completed`, `streak_extended` and `streak_lost`. The obsolete Neon Race game-local challenge storage was removed; `GameShell.saveResult()` and `mergeStats()` delegate record writes to `PlayerData.record()` whenever Player Core is available, so game modules no longer need to write player records directly.

## Adding a game

Copy `dist/games/template`, implement the lifecycle, add one Registry entry, select an adapter, load the files in `index.html`, and use `PlayerData`, `RewardManager` and `Analytics`. For a cosmetic catalog, add `dist/games/<id>/shop/shop.js`, call `TelePlayGameShopEngine.create({ gameId, title, categories, items })`, and expose only visual data. The platform router only needs a launcher mapping while the module is being migrated; new modules should register through `GameSession`.

## Engines

- `canvas` — Arcade Engine and `CanvasGameAdapter`;
- `puzzle` — puzzle module and `PuzzleGameAdapter`;
- `sports` — sports module and `SportsGameAdapter`.

Penalty Duel is the first Sports module. Its five-shot session is isolated in `dist/games/penalty-duel/`; `PenaltyDuelGame` consumes the shared PlayerData, RewardManager, Analytics and Result Screen services. The sports engine deliberately keeps shot data (`direction`, `power`, `curve`, `result`) separate from rendering so Basketball Shot, Hockey Shot, Tennis or Golf can reuse the same trajectory and collision primitives.

Neon Race keeps its gameplay behavior and garage in its own folder. Beat Dash and Neon Hook continue using the shared Canvas engine.

## Admin Panel

`dist/admin/config/admin-config.js` is the allow-list. It supports the future `owner`, `admin` and `moderator` roles; OWNER is configured with Telegram ID `1328706856` (`@reef_ru` is display data). `dist/admin/services/admin-auth.js` reads the Telegram identity and denies access before admin data is rendered. Backend requests carry raw Telegram `initData`; the server must verify its hash, role and permission before reading or mutating global data.

`AdminActionManager` is the only owner mutation boundary. It validates role/permission and the selected target, then routes currency changes through `RewardManager`/`CurrencyManager`, progression and inventory changes through `PlayerData`, and writes an immutable action entry through `AdminEventLog`/`DataProvider`. `GameSession` forwards common events to the same bounded analytics log. Admin Players now supports global provider records, Telegram ID/username search, new/active filters, level/play-count sorting and a player detail view. With the local provider it intentionally shows one local player; with the backend provider it renders the global list and typed transactions/events.

Owner sections are Dashboard, Players, Economy, Shop, Games and Logs. Unsupported destructive operations (delete/reset/direct storage writes) are intentionally absent. To add an administrator later, add a numeric Telegram ID and role to `admin-config.js`; for a real deployment, move the allow-list and action validation to the server.
