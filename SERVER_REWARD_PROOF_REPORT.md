# TelePlay — Server Reward Proof Report

Дата проверки: 20 сентября 2026 г.  
Область: Supabase Edge Function `teleplay-api`, PostgreSQL, frontend DataProvider/GameSession и Admin Panel.

## 1. Новая архитектура наград

Игровой клиент по-прежнему считает очки локально, поэтому управление и UX не менялись. В backend-режиме путь награды теперь такой:

`Game → GameSession → POST /games/result → server validation → Reward Proof → Currency transaction / progress update → player hydration`

Добавлен единый endpoint `POST /games/result`. Клиент передаёт только `gameId`, `sessionId`, `score`, `duration`, `metadata` и timestamp. Поля `coins`, `gems` и `xp` из запроса не используются.

## 2. Проверки сервера

Перед выдачей proof сервер проверяет:

- Telegram initData и владельца сессии;
- существование и завершённость `game_sessions`;
- совпадение игрока, игры, score и duration с записанной сессией;
- окно времени результата и допустимую длительность;
- лимит score, минимальную длительность и score/second;
- частоту отправок (10 результатов/минуту, 100/час);
- повторную отправку результата.

Проверка начинается только после отдельного события старта сессии. Незавершённая или подменённая сессия не выдаёт награду.

## 3. Reward Proof и защита от повторов

Добавлены таблицы:

- `game_results` — результат и причина отказа;
- `reward_proofs` — один proof на одну `session_id`;
- `fraud_events` — подозрительные результаты.

Идентификаторы детерминированы: `reward-proof:<player>:<session>` и отдельные transaction IDs для coins/gems. Уникальные ограничения и серверная idempotency гарантируют, что повтор одного результата не создаёт второй transaction или второй proof. XP и achievements применяются после успешной проверки; records/statistics обновляются только после issued proof.

## 4. Подключённые игры

Единый lifecycle в `GameSession` подключает через `game_finished` все пять игр:

`Neon Race`, `Block Grid`, `Beat Dash`, `Neon Hook`, `Penalty Duel`.

Локальные вызовы `RewardManager.award()` сохранены для совместимости игрового кода, но в backend-режиме они не меняют валюту/XP и возвращают `reward_proof_required`. Реальная награда приходит только от `/games/result`.

## 5. Серверные правила

Правила расчёта находятся в Edge Function и не принимаются из браузера. Они ограничивают coins/XP для каждой игры и используют только проверенный score/result metadata. Клиентское поле `reward` игнорируется.

## 6. Anti-cheat foundation

При невозможном score, слишком короткой длительности или превышении физически допустимого score rate результат получает `422 result_rejected`, а причина записывается в `fraud_events`. Прямой `POST /transactions` с `type=earn` по-прежнему возвращает `403 server_reward_required`.

## 7. Admin Panel

Добавлен раздел **Security / Rewards**. Он читает защищённые owner-only endpoints:

- `GET /reward-proofs`;
- `GET /game-results`;
- `GET /fraud-events`.

В разделе отображаются выданные proofs, отклонённые результаты и fraud events. Вызвать эти endpoints без OWNER Telegram identity нельзя.

## 8. База и production

Миграция применена к проекту `hmggjvnvrpijkbeojjgp`. Новые таблицы имеют внешние ключи к players/game_sessions, unique session/proof constraints, индексы по player/status/time и включённый RLS. Доступ `anon` и `authenticated` отозван; чтение выполняет только Edge Function через серверное соединение.

Также включён RLS для `player_migrations`, ранее отмеченный Supabase как critical. После исправления остались только информационные lint-сообщения о внутренних таблицах без публичных policies — это ожидаемо при прямом server-side доступе и отсутствии Data API grants.

Edge Function `teleplay-api` опубликована version 14; health endpoint отвечает 200, unauthenticated `/games/result` отвечает 401, CORS preflight с production Site origin отвечает 204.

## 9. Проверка

Локальный набор: **22/22 теста прошли**.

Проверены сценарии:

1. Обычная завершённая сессия получает один issued proof, coins и XP.
2. Повторная отправка возвращает `duplicate=true`, баланс не увеличивается.
3. Подменённый/невозможный score отклоняется и создаёт fraud event.
4. Чужой игрок не может прочитать или завершить сессию.
5. Прямой earn transaction заблокирован.
6. Существующие auth, shop, migration и admin security tests не сломаны.

## 10. Ограничения перед закрытой бетой

- Нужен один реальный Telegram smoke-test на production с каждой из пяти игр: старт → finish → issued proof → повтор.
- Нужен отдельный нагрузочный прогон на 100/1 000/10 000 игроков; базовые индексы и лимиты уже добавлены.
- Текущие правила — anti-cheat foundation, а не доказательство каждого physics tick. Для закрытой беты рекомендуется ручной просмотр fraud events и постепенная калибровка score-rate лимитов.

## Итог

Система Reward Proof готова к закрытой бете на уровне **88%**: backend flow, server-authoritative economy, idempotency, anti-cheat baseline, production schema и Admin Panel подключены. До 100% остаются реальные Telegram/game smoke-tests и нагрузочная проверка production.
