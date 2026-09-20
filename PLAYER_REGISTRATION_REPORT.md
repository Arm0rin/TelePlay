# TelePlay — отчёт по автоматической регистрации и миграции

Дата проверки: 20.09.2026

## 1. Новая схема входа

```text
Telegram Mini App
  → Telegram initData (подпись проверяется Edge Function)
  → GET /players/me
  → если профиля нет: POST /players/me
  → если есть старый локальный прогресс: POST /players/me/import (один раз)
  → PostgreSQL/Supabase
  → запуск игры
```

`telegramId` берётся только из проверенного `initData` и является единственным внешним идентификатором игрока. Поля `telegramId` из тела запроса не используются для выбора аккаунта.

## 2. Создание серверного профиля

При первом успешном Telegram-входе создаются связанные записи в `players`, `progress`, `economy` и `inventory`:

- level 1, XP 0, rank `rookie`;
- Coins/Gems 0 (начальные значения не берутся из браузера);
- starter item `avatar-frame-neon`;
- пустые records/statistics/achievements.

Повторный вход на другом устройстве находит тот же профиль по `telegramId`.

## 3. Автоматическая миграция

Технический экран миграции удалён. Клиент сам передаёт снимок старого прогресса после создания/поиска профиля; игрок не выбирает режим и не видит localStorage/backend.

Введена таблица `player_migrations` с уникальным ключом `(player_id, migration_version)`. Для текущей политики используется версия `local-v1`, серверный ID имеет вид `migration:<telegramId>:local-v1`, а в журнале сохраняются источник, время, версия и metadata.

Переносятся с ограничениями:

- прогресс: level, XP, rank, streak, achievements;
- статистика и records только для известных игр и в допустимых пределах;
- inventory только для известных серверному каталогу предметов, с фильтрацией scope/equipped;
- presentation settings/activity.

Экономика из localStorage не импортируется: Coins/Gems всегда начинаются с серверного значения. Это намеренная политика `economyPolicy=server-defaults`, предотвращающая накрутку при подделке localStorage. Начисления выполняются только серверными транзакциями/OWNER-действиями.

Повторный импорт возвращает текущий серверный профиль и не изменяет его. При очистке браузера профиль восстанавливается через `GET /players/me`.

## 4. Обновления интерфейса

- удалены `migrationScreen`, кнопки выбора и отображение локальных Coins/Gems;
- добавлено только нейтральное состояние «Загрузка профиля…»;
- при временной недоступности показывается «Не удалось загрузить профиль. Повторяем подключение…» с Retry;
- Admin Panel получает `account` и `migration` metadata: Telegram, `telegram_registration`, Completed/Not required, дата и версия.

## 5. Проверки безопасности

Проверено и сохранено:

- Telegram HMAC/hash, срок действия initData и запрет входа без Telegram;
- доступ к чужому `/players/:telegramId` и чужому PUT запрещён;
- `/players`, транзакции, аналитика и admin actions защищены OWNER/identity checks;
- клиентский state sync не может записать Coins, Gems, XP, Level, records или statistics;
- shop price/item/source проверяются сервером;
- transaction IDs и покупки идемпотентны;
- игровой score/duration/gameId ограничены сервером;
- `player_migrations` защищает повторный импорт уникальным ограничением.

## 6. Тестирование

Локальный набор: **20/20 тестов пройдено** (`backend-api.test.mjs`, `data-provider.test.mjs`). Покрыты:

1. новый Telegram-игрок создаётся на сервере;
2. старый локальный прогресс импортируется автоматически без UI;
3. повторная миграция не перезаписывает серверные данные;
4. экономика из локального снимка отклоняется;
5. временный API outage сохраняет локальный кэш и позволяет Retry;
6. чужие профили и чужие записи отклоняются;
7. магазин, транзакции и game sessions валидируются сервером.

Production smoke:

- Edge Function `teleplay-api` version 12 — ACTIVE;
- `/health` — HTTP 200;
- `/players/me` без initData — HTTP 401;
- CORS для live Site origin — HTTP 204;
- Site version 52 опубликована: https://turboplay-racing.llmim4yvn46ig.chatgpt.site

## 7. Ограничение перед закрытой бетой

Supabase advisor помечает `public.player_migrations` как таблицу без RLS. Сейчас для `anon` и `authenticated` права на таблицу отозваны, а Edge Function работает через серверное подключение, поэтому клиентский Supabase API не получает таблицу напрямую. Для полного закрытия linter-пункта нужно отдельно согласовать и применить:

```sql
alter table public.player_migrations enable row level security;
```

Я не включал RLS автоматически: без согласованных service-role/Edge-политик это может заблокировать серверные операции миграции.

## 8. Итоговая готовность

Функциональный flow автоматической регистрации и миграции готов: **90%**. До закрытой беты требуется закрыть RLS advisory и выполнить один реальный Telegram smoke-тест с тестовым аккаунтом в Mini App. До этого запускать массовую группу не рекомендуется; после этих двух шагов можно начинать с 5–10 тестовых игроков и наблюдать журнал миграций, ошибки авторизации и отклонённые транзакции.
