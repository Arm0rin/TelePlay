# TelePlay — Telegram Stars activation report

Дата аудита: 2026-09-20 (UTC)

## Итог

Платёжный контур TelePlay уже реализует серверное создание invoice, XTR (`Telegram Stars`), `pre_checkout_query`, `successful_payment`, идемпотентную выдачу TeleGems и OWNER-раздел Payments. Реальная активация в production **не завершена**, потому что утверждённые цены пакетов и production secrets не были предоставлены в текущем окружении. Никакие заглушки или выдуманные цены не использовались.

Production остаётся без реальных платежей: `payments = 0`, payment transactions = `0`, payment analytics = `0`.

## Версии и состояние

| Компонент | Состояние |
|---|---|
| Site | version 58 |
| Edge Function | `teleplay-api` version 19 (production; код изменений deployed, реальные пакеты disabled) |
| Supabase | `ACTIVE_HEALTHY`, PostgreSQL 17.6.1 |
| Migration history | 7 зарегистрированных миграций; drift отсутствует |
| Automated tests | 25/25 passed |

Проверка production read-only подтвердила: `players=2`, `payments=0`, `transactions(source='payment')=0`, payment analytics events = `0`.

## Настроенные пакеты

В репозитории нет реальных цен; draft-пакеты отключены. Production secret `TELEPLAY_PAYMENT_PACKAGES` должен содержать утверждённый серверный JSON с полями:

```json
[
  {
    "id": "<stable-package-id>",
    "name": "<display-name>",
    "currency": "XTR",
    "starsPrice": "<approved-positive-integer>",
    "gemsAmount": "<approved-positive-integer>",
    "bonus": "<approved-non-negative-integer>",
    "active": true
  }
]
```

Значения в кавычках выше являются placeholders и не должны загружаться как production-конфигурация. Нормализатор также принимает существующие имена `amount`/`enabled` для обратной совместимости; итоговая цена всегда берётся с backend. Цены не захардкожены в Site или клиентском коде.

## Payment flow и security

1. Авторизованный Telegram player получает список активных пакетов.
2. Backend выбирает пакет по `packageId`, игнорирует клиентские `amount`/Gems и создаёт pending payment с уникальным `invoice_payload` и idempotency key.
3. Edge Function вызывает Telegram `createInvoiceLink` с `currency: XTR`, одним price component и пустым `provider_token`.
4. Webhook принимает только запрос с `X-Telegram-Bot-Api-Secret-Token`.
5. `pre_checkout_query` проходит только при совпадении payload, Telegram user ID, currency и total amount.
6. `successful_payment` дополнительно проверяет payload, XTR, сумму и `telegram_payment_charge_id`.
7. Серверная транзакция `payment:<paymentId>:gems` идемпотентно начисляет Gems и записывает `source='payment'`.
8. Повторный callback возвращает duplicate и не начисляет Gems повторно; altered payload/amount отклоняется.

Это соответствует Bot API: для Stars используется `XTR`, `provider_token` может быть пустым, а `prices` должен содержать ровно один компонент; `SuccessfulPayment` содержит payload, currency, total amount и Telegram charge ID. Telegram передаёт webhook secret header и повторяет update при non-2xx ответе: [createInvoiceLink](https://core.telegram.org/bots/api#createinvoicelink), [SuccessfulPayment](https://core.telegram.org/bots/api#successfulpayment), [setWebhook](https://core.telegram.org/bots/api#setwebhook).

## Изменённые файлы

- `server/payment-catalog.mjs` — поддержка серверной структуры `starsPrice`/`bonus`/`active` с обратной совместимостью.
- `supabase/functions/teleplay-api/server/payment-catalog.mjs` — тот же нормализатор для Edge Function.
- `server/index.mjs` и `supabase/functions/teleplay-api/server/index.mjs` — добавлено идемпотентное событие `first_payment_completed` для первого завершённого платежа.
- `tests/backend-api.test.mjs` — проверены новые поля, серверная цена и одноразовое first-payment событие.
- `TELEPLAY_TELEGRAM_STARS_ACTIVATION_REPORT.md` — этот отчёт.

Production schema и production data не изменялись. Миграции не создавались и не применялись. Site остался version 58; Edge Function обновлена с v18 до v19 только для описанных runtime-проверок.

## Verification

- `node --test`: **25/25 passed**.
- Supabase schema: `payments` существует, RLS включён, прямые grants для anon/authenticated отсутствуют; unique `invoice_id`, `invoice_payload`, `telegram_payment_charge_id` и idempotency index сохранены.
- Тесты подтверждают: forged amount отклоняется, повторный callback не создаёт вторую transaction, обычный player не видит `/payments`, analytics first-payment событие появляется один раз.
- Production health endpoint отвечал HTTP 200.

## Что требуется вручную перед включением

1. Утвердить конкретные `starsPrice`, `gemsAmount`, `bonus` и список `active` пакетов. Без этого activation не выполнять.
2. В Supabase Edge Function secrets задать `TELEPLAY_PAYMENT_PACKAGES` (валидный JSON из утверждённых значений) и сгенерированный `TELEPLAY_PAYMENT_WEBHOOK_SECRET`. Секреты не отправлять в чат и не помещать в git.
3. В BotFather для того же бота включить Telegram Stars для цифровых товаров. Для XTR provider token не нужен; `TELEGRAM_PAYMENT_PROVIDER_TOKEN` не задавать.
4. Настроить webhook на:

   `https://hmggjvnvrpijkbeojjgp.supabase.co/functions/v1/teleplay-api/telegram/payments/webhook`

   с тем же `secret_token`, что и `TELEPLAY_PAYMENT_WEBHOOK_SECRET`, затем проверить `getWebhookInfo` и отсутствие ошибок доставки.
5. После ручной конфигурации проверить v19 через `/health`, получить package list из Telegram Mini App и только затем попросить подтверждение перед реальной покупкой. Дополнительный deploy для одной лишь смены secrets не требуется.

## Реальная покупка и failure tests

Реальная покупка, отмена, webhook timeout и double-click в этой сессии **не выполнялись**: нет production package prices/secrets и нет Telegram WebView с валидным initData. Запускать оплату через внешний браузер или подделанный initData нельзя. После ручной настройки нужно выполнить одну подтверждённую покупку OWNER/тестовым аккаунтом и проверить payment row, completed status, Gems balance, transaction, analytics и OWNER Payments.

## Готовность

Код и автоматические проверки готовы к конфигурации Stars. Production ещё **не готов к первой реальной покупке** до выполнения ручных шагов выше и action-time подтверждения финансовой операции. До этого момента платежи должны оставаться disabled.
