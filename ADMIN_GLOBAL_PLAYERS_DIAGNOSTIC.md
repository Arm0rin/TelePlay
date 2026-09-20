# TelePlay — диагностический отчёт: глобальный список игроков

Дата: 20 сентября 2026 г.

## Причина

В production включён `DATA_MODE=backend`, однако после временной недоступности API `DataProvider` переключался на `LocalStorageProvider` для игрового fallback. Публичный метод `DataProvider.listPlayers()` делегировал вызов активному провайдеру без учёта `strict: true`.

Поэтому при открытии Admin Panel в момент fallback запрос списка не уходил в `GET /players`: панель получала единственный локальный профиль OWNER и помечала его как backend-данные. Это был frontend-разрыв, а не проблема регистрации, PostgreSQL или RLS.

## Реальная база

Проверка `public.players` подтвердила:

| Проверка | Результат |
| --- | --- |
| Количество профилей | 2 |
| Уникальные Telegram ID | 2 |
| OWNER `1328706856` | 1 запись |
| Второй аккаунт `8272484975` | 1 запись |
| Связанные progress/economy/inventory | Есть у обоих |

`telegram_id` остаётся уникальным ключом, дублирования нет.

## Исправление

В `dist/core/data-provider.js` добавлен отдельный выбор провайдера чтения:

- при `DATA_MODE=backend` административные чтения всегда используют `BackendProvider`;
- `strict: true` выполняет настоящий запрос к Edge Function, даже если игровой provider ещё находится в fallback;
- localStorage больше не может подменить глобальный список, транзакции, события, admin actions или security-данные.

Сохранён обычный игровой graceful fallback: для нестрогих пользовательских чтений он работает как прежде.

## Проверка API и доступа

- `GET /players` требует валидный Telegram initData и OWNER ID `1328706856`.
- Обычный игрок получает `403 admin_forbidden`.
- OWNER получает список всех игроков без фильтра по текущему Telegram ID.
- `GET /players/:telegramId` разрешён только самому игроку или OWNER.
- RLS включён на `players`, `progress`, `economy`, `inventory`, `transactions`, `admin_actions`.
- Роли `anon` и `authenticated` не имеют прямого `SELECT` к этим таблицам; браузер работает только через Edge Function.

## Тесты

Добавлены проверки:

1. После временного fallback strict admin read всё равно запрашивает `/players` и возвращает два профиля.
2. Обычный игрок не может вызвать `GET /players`.
3. OWNER получает полный список игроков.

Полный тестовый набор: **24/24 успешно**.

## Итоговый поток

`Telegram initData OWNER → Edge Function /players → PostgreSQL players → BackendProvider (strict) → AdminData → Admin Panel`

После публикации OWNER должен закрыть и заново открыть Mini App либо обновить WebView, затем открыть вкладку **Players**. Панель запросит реальный список и покажет оба существующих Telegram-аккаунта.
