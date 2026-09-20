# TelePlay backend security audit

Дата проверки: 20 сентября 2026. Область: Supabase Edge Function `teleplay-api`, PostgreSQL, frontend `BackendProvider`, Admin Panel и игровые записи.

## Итог

Серверная авторизация и границы доступа работают. Критические пути накрутки валюты, подмены цены магазина, подмены Telegram ID и повторной покупки закрыты. Production smoke-проверка: `/health` — 200, запрос без Telegram — 401, повреждённый initData — 401, CORS preflight — 204. Локальные регрессионные тесты: **20 passed, 0 failed**.

Текущая готовность серверной части: **80%**. Для закрытой технической беты без начисления наград с клиента — приемлемо. Для публичной игровой экономики — нет: сначала нужны server-issued reward proofs и политика переноса старого прогресса.

Развёртывания:

- Supabase migration `security_hardening` применена.
- Supabase migration `shop_purchase_unique` применена; создан `idx_shop_purchase_once`.
- Edge Function `teleplay-api`, version 11, ACTIVE.
- Site version 50 опубликована: `https://turboplay-racing.llmim4yvn46ig.chatgpt.site`.

## 1. Authentication audit

- Telegram `initData` проверяется на сервере через HMAC-SHA256 по схеме Telegram Web Apps (`WebAppData` + bot token).
- Проверяются `hash`, `auth_date`, срок действия 24 часа и будущая дата не более 60 секунд.
- `telegramId` берётся только из подписанного `user.id`; тело запроса его не переопределяет.
- Запрос без initData и с повреждённым hash отклоняется с 401.
- OWNER определяется только серверным `OWNER_ID`/`TELEPLAY_OWNER_IDS`; роль из браузера не используется.
- Подмена ID другого игрока через `GET`/`PUT` отклоняется.

Ограничение: окно initData в 24 часа допускает replay до истечения срока. Для более строгой модели перед публичным запуском следует уменьшить его до 1 часа и добавить контроль повторов на edge-уровне.

## 2. API security matrix

| Endpoint | Auth | Право | Результат проверки |
|---|---|---|---|
| `GET /players` | Telegram + OWNER | owner | Только глобальный список владельцу |
| `GET /players/:telegramId` | Telegram | свой ID или OWNER | Чужой игрок — 403 |
| `GET /players/me` | Telegram | свой ID | ID из initData |
| `PUT /players/:telegramId` | Telegram | только свой ID | Чужая запись — 403; identity из body игнорируется |
| `GET /transactions` | Telegram | свои или OWNER | Чужая история — 403 |
| `POST /analytics/events` | Telegram | свой игрок | playerId назначается сервером; есть idempotency и rate limit |
| `POST /admin/actions` | Telegram + OWNER | owner | Проверка target, операции, idempotency и журналирование |

Также проверены `POST/GET /game-sessions`: сессия привязана к Telegram ID, конфликт ID другого игрока — 409.

## 3. Player data integrity

Клиент больше не является источником истины для `coins`, `gems`, `XP`, `level`, achievements, records и statistics. `PUT /players/me/state` принимает presentation state и только серверно подтверждённый inventory.

Первичный localStorage import одноразовый, но значения экономики, прогресса, достижений, records и inventory из браузера намеренно не импортируются: новый серверный профиль стартует с безопасными значениями. Повторный import существующий профиль не меняет.

Inventory разрешает только:

- известные бесплатные предметы каталога;
- предметы с подтверждённой shop-транзакцией;
- предметы, выданные OWNER.

## 4. Economy audit

Исправлено:

- браузерные `earn`-транзакции отклоняются `403 server_reward_required`;
- owner grants проходят только `/admin/actions`;
- transaction ID проверяется в рамках игрока, collision с чужим игроком — 409;
- PostgreSQL использует атомарный compare-and-swap update + ledger insert;
- сумма, source, type, metadata и ID ограничены по размеру;
- rejected reward writes удаляются из frontend queue и не переводят приложение в бесконечный fallback.

Сценарии аудита:

1. Один reward, отправленный 10 раз: сервер не начисляет, отвечает `server_reward_required`.
2. Повторная покупка: `item_already_owned`; дополнительно защищена уникальным DB index.
3. Подмена клиентского баланса: state sync игнорирует economy, серверное значение сохраняется.

Главное оставшееся ограничение: игра пока не имеет серверного reward proof. Поэтому автоматические игровые награды не начисляются; тестовые начисления выполняются OWNER-действием.

## 5. Shop security

Добавлен серверный каталог всех текущих profile/game items. Для spend проверяются item ID, shop source, currency и точная цена. Цена из браузера не доверяется. Unknown item, неправильная цена и неправильный source отклоняются.

Дубли защищены двумя уровнями: проверка текущего inventory/ledger и PostgreSQL partial unique index `idx_shop_purchase_once`.

## 6. Game result security

`POST /game-sessions` теперь проверяет:

- зарегистрированный `gameId`;
- score — целое число от 0 до 100 000;
- duration — от 0 до 24 часов;
- started/finished timestamp — не старше 7 дней и не более чем на 5 минут в будущем;
- reported reward больше 1 000 отклоняется и вообще не используется для начисления;
- результат сохраняется через allowlist полей;
- session ID нельзя переиспользовать другим игроком или другой игрой.

Проверка ограничивает очевидные payloads вроде `score: 999999` и `reward: 100000`, но не является anti-cheat: правдоподобный score до лимита всё ещё можно подделать. Для публичной экономики нужен server-issued proof или server-side game simulation.

## 7. Database audit

Проверено наличие таблиц `players`, `progress`, `economy`, `inventory`, `transactions`, `game_sessions`, `analytics_events`, `admin_actions`.

- FK на `players.telegram_id` есть для дочерних таблиц.
- PK/unique ID есть на players, transactions, sessions, events и admin actions.
- Check constraints для level, XP, coins, gems, currency/type присутствуют.
- Индексы для last active, player + created_at и admin target присутствуют.
- `anon` и `authenticated` лишены table grants отдельной migration; запись идёт только через Edge Function DB connection.
- Supabase advisor оставляет INFO `rls_enabled_no_policy` на 8 таблицах. Это ожидаемо для server-only модели после revoke grants, но при публикации таблиц через Data API нужно добавить RLS policies: [Supabase RLS advisor](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).
- Performance advisor показывает 4 пока неиспользуемых индекса на низком трафике; удалять их до нагрузочного теста не следует: [Supabase index advisor](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index).

## 8. Admin Panel security

Клиентская Admin Panel — только UI-guard. Реальная защита находится в API: подписанный Telegram initData + server-side OWNER allow-list. Прямой вызов `/players`, `/transactions?playerId=...`, `/analytics/events`, `/admin/actions` без OWNER отклоняется.

Каждый admin action содержит `adminId`, `role`, `targetPlayerId`, `action`, metadata/result и timestamp. Операции XP и streak ограничены серверными пределами. Unknown item/target отклоняются.

## 9. Logging and monitoring

- Ошибки API логируются структурированным JSON с `requestId`, status, code и message в Edge Function logs.
- Transactions, game sessions, analytics events и admin actions хранятся в PostgreSQL.
- Для analytics и sessions добавлен per-player rate limit (120 events/min, 30 session writes/min).

Осталось: постоянный отдельный security-event stream, alerting и retention policy. Это MEDIUM для закрытой беты, HIGH перед публичным запуском.

## 10. Performance check

Текущий startup frontend: health + `GET /players/me` (2 запроса). Admin global load делает 4 параллельных чтения. Production cold/warm ответы API наблюдались примерно 8–9 секунд, поэтому frontend timeout увеличен до 20 секунд, health timeout — до 15 секунд.

- До 100 игроков: текущая схема достаточна для технической беты.
- До 1 000: добавить SQL pagination/filtering для player list и load test; не отдавать лишние JSON поля.
- До 10 000: нужен edge rate limiting, pagination/cursors, агрегаты вместо полного scan, connection/load tuning и внешнее мониторинг-хранилище.

## 11. Migration check

- Новый игрок: создаётся по verified Telegram ID с нулевой экономикой и безопасным starter item.
- Старый игрок: import одноразовый, но untrusted economy/progress не принимаются.
- Повторный import: существующий профиль возвращается без overwrite.

До закрытой беты нужно выбрать операционную политику для старых игроков: либо принять reset authoritative progress, либо сделать ручной OWNER-assisted перенос после проверки данных.

## 12. Severity

### CRITICAL — исправлено

- Клиент мог начислять произвольные coins/gems через earn endpoint.
- Клиент мог подменять цену shop и через metadata разблокировать item.
- Local import и state sync принимали authoritative economy/progress.
- Cross-player ID collisions могли раскрыть transaction/session/event данные.

### HIGH — исправлено

- Race condition между economy update и ledger insert.
- Повторная покупка разными transaction IDs.
- Подмена gameId/score/session timestamps без server validation.
- Analytics/session write spam без лимита.

### HIGH — осталось до полноценной игровой беты

- Нет server-issued reward proof/anti-cheat; browser rewards отключены.
- Старый прогресс импортируется только как presentation state, не как authoritative state.
- Внешний rate limit и persistent security alerting отсутствуют.

### MEDIUM/LOW

- Replay window initData 24 часа.
- Player list ограничен 1000 и фильтруется после чтения.
- Advisor INFO по RLS без policy и unused indexes требуют повторной проверки после нагрузки.

## 13. Рекомендации запуска

1. Начать с 5–10 игроков в закрытом техническом тесте.
2. До включения наград считать coins/gems тестовой экономикой и выдавать их OWNER actions.
3. Проверить для каждого тестера: Telegram login, создание профиля, game session, покупку по точной цене, повторный purchase и отказ чужого player ID.
4. Наблюдать Edge logs по `requestId`, `server_reward_required`, `balance_conflict`, `session_id_conflict`, `rate_limited`.
5. Не открывать публичную экономику, пока не появится серверное подтверждение результата игры и утверждённая политика migration.
