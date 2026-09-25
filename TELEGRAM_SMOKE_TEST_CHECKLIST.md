# TelePlay — Telegram smoke-test checklist

Use two real Telegram accounts after the analytics release is published:

- **Account A**: OWNER;
- **Account B**: ordinary player.

Do not copy `initData`, bot tokens, webhook secrets, payment charge IDs, or
screenshots containing them into issue trackers or chat.

## Preconditions

- The deployed `core/analytics.js` contains `schemaVersion: '2026-09'`.
- `GET /health` returns `status: ok` and `database: connected`.
- Both accounts open the Mini App from Telegram, not a regular browser.
- Account B opens the app once through a distinct `startapp` parameter, for
  example a test campaign label with no personal data.

## Account B — player journey

1. Open the Mini App and wait for the catalog.
2. Open one available game from the catalog and finish one round.
3. Restart that game once, finish again, then open a second available game.
4. Open Profile, Challenges, Shop, and return to the catalog.
5. Close the Mini App, reopen it, and confirm that the profile remains the
   same.
6. If payment packages are intentionally enabled for this test, stop before
   payment confirmation unless a separate payment test is authorised.

Expected analytics for the first round:

`app_opened` → `app_ready` → `catalog_viewed` → `game_selected` →
`game_opened` → `game_started` → `game_finished`.

`game_started` and `game_finished` must have the same `gameSessionId` in their
metadata. A normal player must receive `403` if trying to read global analytics
directly.

## Account A — owner verification

1. Open Admin Panel from Telegram.
2. Refresh Dashboard after Account B completes the journey.
3. Confirm Product Funnel has non-zero values for App Opened, Game Selected,
   Game Started, and Game Finished.
4. Confirm the scope label says the latest server event batch, not local data.
5. Open Logs and spot-check that event metadata includes `telemetry` but does
   not include Telegram identity, raw `initData`, or payment credentials.

## Sign-off rules

- **Pass**: Account B completes the first-game journey; event sequence and
  shared session ID are present; Account A sees the funnel; non-owner access is
  denied.
- **Investigate**: events appear only locally, the owner funnel is empty after
  refresh, or start/finish IDs differ.
- **Block release**: real Telegram authentication fails, rewards are granted
  without a server proof, owner-only analytics are exposed, or production
  errors prevent a player from finishing a game.
