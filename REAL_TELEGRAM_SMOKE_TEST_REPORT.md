# TelePlay — Real Telegram Smoke-Test Report

Дата тестирования: 2026-09-20 UTC  
Статус: частично выполнен; реальный Telegram WebView smoke-test заблокирован отсутствием доступной Telegram-сессии в тестовой среде.

## Production versions

- Site: version 58
- Supabase Edge Function `teleplay-api`: version 18
- Supabase project: `ACTIVE_HEALTHY`
- Database engine: PostgreSQL 17.6.1
- Payments: disabled; no real payment flow was started

## Test accounts

ACCOUNT A (OWNER): идентификатор и Telegram WebView-сессия в этой среде не предоставлены; live account test не выполнен.

ACCOUNT B (обычный игрок): идентификатор и Telegram WebView-сессия в этой среде не предоставлены; live account test не выполнен.

Секреты, initData и платёжные данные не сохранялись в отчёт.

## Environment limitation

Production Site открылся в cloud browser, но вне Telegram WebView:

- `window.Telegram.WebApp` отсутствует;
- Telegram `initData` отсутствует;
- сервер корректно отказал в загрузке профиля и вернул клиент в fallback-состояние;
- Admin UI не отображается в неавторизованном состоянии.

Поэтому не выполнялись действия, которые могли бы создать локальный или production игровой результат без настоящей Telegram identity. Успешный ACCOUNT A/B smoke-test не заявляется.

## Results

| Area | Result | Evidence |
|---|---|---|
| Telegram authentication, real WebView | BLOCKED | No Telegram WebView/initData in cloud browser |
| Player registration, real account | BLOCKED | Requires ACCOUNT B initData |
| Second device | BLOCKED | Requires the same ACCOUNT B on another Telegram device |
| OWNER Admin Panel | BLOCKED | Requires ACCOUNT A Telegram session |
| Non-owner security | PASS for negative API probes | No initData: 401; forged initData: 401; automated owner/foreign-player tests pass |
| Five live game cycles | BLOCKED | Not run outside Telegram identity |
| Server Reward Proof live cycle | PASS in automated coverage; live cycle blocked | Automated suite validates idempotency and fraud rejection |
| Economy and transactions | PASS in automated coverage; live mutation not performed | No manual balance/resource changes |
| Inventory purchase | PASS in automated coverage; live purchase blocked | Automated ownership/idempotency tests pass |
| Save/sync across Telegram reopen | BLOCKED | Requires authenticated Telegram session |
| Analytics production events | BLOCKED for live smoke events | Covered by backend tests; no synthetic production events added |
| Error handling | PASS for API probes and automated tests | Auth failures, fallback, outage and idempotency paths covered |

## Automated regression

`node --test tests/*.test.mjs`

- 25 tests
- 25 passed
- 0 failed

The suite covers Telegram signature validation, registration defaults, backend sync, player permissions, game session validation, reward proof idempotency, fraud events, shop ownership, payment protections and local fallback behavior.

## Production API probes

- `GET /health`: HTTP 200
- request without Telegram initData: HTTP 401
- forged Telegram initData: HTTP 401
- payment packages without auth: HTTP 401

Observed five-sample `/health` average from the cloud runner: approximately 8.20 s. This includes the current remote/browser network path and must be rechecked from Telegram clients before treating it as an application SLA measurement.

## Production database integrity

Read-only post-test snapshot:

- players: 2
- transactions: 17
- game results: 9
- reward proofs: 9
- fraud events: 0
- payments: 0

Integrity checks:

- orphan progress/economy/inventory rows: 0
- orphan transactions/game results/reward proofs: 0
- duplicate Telegram player IDs: 0
- duplicate result sessions: 0
- duplicate reward-proof sessions: 0

No production rows were inserted, updated or deleted by this smoke-test attempt.

## Issues and severity

### Critical

- Real Telegram smoke-test is not complete because ACCOUNT A, ACCOUNT B and Telegram WebView access are unavailable in this environment. This is a test-execution blocker, not evidence of a production authentication failure.

### High

- None observed.

### Medium

- Cloud-runner `/health` latency averaged approximately 8.20 s. Re-test from Telegram WebView and the target user region before beta sign-off.

### Low

- Telegram WebApp SDK emitted compatibility warnings in the non-Telegram browser harness. They were not treated as production failures because the harness is not a Telegram client.

## Changes made

- No production schema changes.
- No player, economy, inventory, transaction, reward or analytics data changes.
- No payment configuration changes.
- No Site or Edge Function deployment.
- This report only was added to the repository.

## Closed-beta readiness

Backend and security baselines remain suitable for the next validation step, but TelePlay is **not yet cleared as fully smoke-tested for closed beta**. Before sign-off, run the manual Telegram WebView matrix with the real OWNER account and a separate ordinary-player account, including all five games, duplicate-result submission, Admin Panel checks, second-device restore and live analytics verification.
