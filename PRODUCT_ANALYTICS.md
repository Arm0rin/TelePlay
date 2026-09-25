# TelePlay Product Analytics

## Purpose

This is the minimum analytics contract for making product decisions before
scaling acquisition. Events are stored through the existing authenticated
`POST /analytics/events` endpoint and are visible to the owner in Admin Panel.

The client never sends Telegram `initData`, user profile fields, payment
credentials, or arbitrary error objects as analytics metadata.

## Event envelope

Every client event includes:

- `event` — stable snake_case name;
- `gameId` — when the event belongs to a game;
- `telemetry.schemaVersion` — currently `2026-09`;
- `telemetry.launchSessionId` — random ID scoped to the current Mini App tab;
- `telemetry.platform`, `telegramVersion`, `colorScheme`, `language`, and
  rounded viewport size;
- `telemetry.startParam` — optional Telegram campaign/deep-link parameter.

Values are depth, length, and key-count limited before transport. The server
also limits payload size and event rate.

## Initial funnel

| Step | Event | Decision it supports |
| --- | --- | --- |
| Mini App opened | `app_opened` | Which channels produce real launches |
| App bootstrapped | `app_ready` / `app_bootstrap_failed` | Reliability of the first screen |
| Catalog shown | `catalog_viewed` | Availability of the core product surface |
| Game chosen | `game_selected` | Discoverability and game-card appeal |
| Game begun | `game_started` | First-play conversion |
| Game ended | `game_finished` | Completion and session quality |
| Shop/payment | `shop_opened`, `payment_started`, `payment_completed` | Monetization only after retention is healthy |

`game_started` and `game_finished` receive the same `gameSessionId`; a backend
game session uses that ID too when server mode is enabled. This is the basis
for future session-duration and cohort queries.

## Current owner dashboard

The Admin Panel dashboard aggregates the currently loaded event sample into:

- unique players who opened the app, selected a game, started and finished it;
- selection, first-game, completion, and payment conversion percentages;
- explicit sample-scope label: local device or the latest server event batch.

The current backend endpoint intentionally returns at most 1,000 recent
events. These figures are operational diagnostics, not full retention cohorts.
For D1/D7, the next backend iteration should add an owner-only aggregate
endpoint grouped by `player_id` and UTC calendar day.

## Release checklist

1. Open TelePlay from a real Telegram conversation with and without a
   `startapp` parameter.
2. Finish at least one round in each available game and confirm that start and
   finish events share a `gameSessionId`.
3. Confirm an ordinary player cannot read `GET /analytics/events`.
4. Confirm the owner sees the expected funnel counts in Admin Panel.
5. Keep payment events as UI telemetry only; payment settlement remains
   webhook-authoritative on the server.
