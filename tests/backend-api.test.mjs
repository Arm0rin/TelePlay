import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { handler, verifyTelegramInitData } from '../server/index.mjs';

const schema = await readFile(new URL('../server/schema.sql', import.meta.url), 'utf8');
const BOT_TOKEN = 'test:bot-token';

class D1Database {
  constructor() { this.sqlite = new DatabaseSync(':memory:'); this.sqlite.exec(schema); }
  prepare(sql) {
    const statement = this.sqlite.prepare(sql);
    return {
      bind: (...args) => ({
        first: async () => statement.get(...args) || null,
        all: async () => ({ results: statement.all(...args) }),
        run: async () => statement.run(...args)
      })
    };
  }
  async batch(statements) { const results = []; for (const statement of statements) results.push(await statement.run()); return results; }
  close() { this.sqlite.close(); }
}

function initData(userId, username = 'player') {
  const fields = { auth_date: String(Math.floor(Date.now() / 1000)), query_id: `test-${userId}`, user: JSON.stringify({ id: Number(userId), username, first_name: 'Test' }) };
  const check = Object.entries(fields).sort(([left], [right]) => left.localeCompare(right)).map(([key, value]) => `${key}=${value}`).join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
  const hash = createHmac('sha256', secret).update(check).digest('hex');
  return new URLSearchParams({ ...fields, hash }).toString();
}

const request = (path, { method = 'GET', userId = '42', body, origin = 'https://teleplay.example', headers = {} } = {}) => new Request(`https://api.teleplay.example${path}`, {
  method,
  headers: { Origin: origin, 'Content-Type': 'application/json', 'X-Telegram-Init-Data': initData(userId, userId === '1328706856' ? 'reef_ru' : 'player'), ...headers },
  ...(body === undefined ? {} : { body: JSON.stringify(body) })
});

const envFor = (db, extra = {}) => ({ DB: db, TELEGRAM_BOT_TOKEN: BOT_TOKEN, OWNER_ID: '1328706856', WEB_ORIGIN: 'https://teleplay.example', ...extra });

test('health reports database readiness', async () => {
  const unavailable = await handler(request('/health'), {});
  assert.equal(unavailable.status, 503);
  const db = new D1Database();
  const healthy = await handler(request('/health'), envFor(db));
  assert.equal(healthy.status, 200);
  const payload = await healthy.json();
  assert.equal(payload.status, 'ok');
  assert.equal(payload.database, 'connected');
  assert.deepEqual(payload.auth, { telegramConfigured: true, ownerConfigured: true });
  db.close();
});

test('Telegram initData rejects tampered signatures and expired timestamps', async () => {
  const valid = initData('42');
  const tampered = new URLSearchParams(valid);
  tampered.set('user', JSON.stringify({ id: 99, username: 'spoof' }));
  await assert.rejects(() => verifyTelegramInitData(tampered.toString(), BOT_TOKEN), error => error.code === 'telegram_auth_invalid');
  const expiredFields = { auth_date: String(Math.floor(Date.now() / 1000) - 90000), query_id: 'expired', user: JSON.stringify({ id: 42 }) };
  const check = Object.entries(expiredFields).sort(([left], [right]) => left.localeCompare(right)).map(([key, value]) => `${key}=${value}`).join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
  const expired = new URLSearchParams({ ...expiredFields, hash: createHmac('sha256', secret).update(check).digest('hex') });
  await assert.rejects(() => verifyTelegramInitData(expired.toString(), BOT_TOKEN), error => error.code === 'telegram_auth_expired');
});

test('verified Telegram user can be created and loaded', async () => {
  const db = new D1Database(), env = envFor(db);
  const created = await handler(request('/players/me', { method: 'POST' }), env);
  assert.equal(created.status, 201);
  const createdBody = await created.json();
  assert.equal(createdBody.player.telegramId, '42');
  assert.equal(createdBody.player.economy.coins, 0);
  const loaded = await handler(request('/players/me'), env);
  assert.equal(loaded.status, 200);
  assert.equal((await loaded.json()).player.username, 'player');
  db.close();
});

test('state sync saves progress but cannot overwrite server economy', async () => {
  const db = new D1Database(), env = envFor(db);
  await handler(request('/players/me', { method: 'POST' }), env);
  const synced = await handler(request('/players/me/state', { method: 'PUT', body: { progress: { level: 8, xp: 700, totalXP: 1700, rank: 'player' }, economy: { coins: 999999, gems: 999999 }, statistics: { totalGames: 12 }, inventory: { profile: { ownedItems: ['avatar-frame-neon'], equippedItems: {}, purchaseHistory: [] }, games: {} } } }), env);
  assert.equal(synced.status, 200);
  const value = (await synced.json()).player;
  assert.equal(value.progress.level, 1);
  assert.equal(value.progress.totalXP, 0);
  assert.equal(value.statistics.totalGames || 0, 0);
  assert.equal(value.economy.coins, 0);
  assert.equal(value.economy.gems, 0);
  db.close();
});

test('one-time local import cannot overwrite an existing server player', async () => {
  const db = new D1Database(), env = envFor(db), snapshot = { profile: { id: '77', username: 'old' }, progress: { level: 4, totalXP: 400 }, economy: { coins: 88, gems: 5 }, inventory: { profile: { ownedItems: ['avatar-frame-neon'] }, games: {} } };
  const first = await handler(request('/players/me/import', { method: 'POST', userId: '77', body: snapshot }), env);
  assert.equal(first.status, 201);
  const firstBody = await first.json();
  assert.equal(firstBody.player.economy.coins, 0);
  assert.equal(firstBody.player.progress.level, 4);
  assert.equal(firstBody.player.migration.completed, true);
  assert.equal(firstBody.player.migration.version, 'local-v1');
  const second = await handler(request('/players/me/import', { method: 'POST', userId: '77', body: { ...snapshot, progress: { level: 99, totalXP: 999999 }, economy: { coins: 999, gems: 999 } } }), env);
  assert.equal(second.status, 200);
  const value = await second.json();
  assert.equal(value.imported, false);
  assert.equal(value.player.economy.coins, 0);
  assert.equal(value.player.progress.level, 4);
  assert.equal((await handler(request('/players/77', { userId: '77' }), env).then(response => response.json())).player.account.source, 'telegram_registration');
  db.close();
});

test('currency transactions are idempotent and owner sees global players', async () => {
  const db = new D1Database(), env = envFor(db);
  await handler(request('/players/me', { method: 'POST' }), env);
  await handler(request('/players/me', { method: 'POST', userId: '1328706856' }), env);
  const transaction = { id: 'reward:42:first', currencyType: 'coins', type: 'earn', amount: 25, source: 'reward', metadata: { reason: 'test' } };
  const first = await handler(request('/transactions', { method: 'POST', body: transaction }), env);
  const second = await handler(request('/transactions', { method: 'POST', body: transaction }), env);
  assert.equal(first.status, 403);
  assert.equal(second.status, 403);
  const adminBody = { id: 'admin:grant:42', action: 'currency_granted', targetPlayerId: '42', operation: 'currency', amount: 25, currencyType: 'coins', reason: 'test' };
  const grant = await handler(request('/admin/actions', { method: 'POST', userId: '1328706856', body: adminBody }), env);
  assert.equal(grant.status, 201);
  assert.equal((await grant.json()).transaction.balanceAfter, 25);
  const duplicateGrant = await handler(request('/admin/actions', { method: 'POST', userId: '1328706856', body: adminBody }), env);
  assert.equal(duplicateGrant.status, 200);
  assert.equal((await duplicateGrant.json()).duplicate, true);
  const players = await handler(request('/players', { userId: '1328706856' }), env);
  assert.equal(players.status, 200);
  assert.equal((await players.json()).players.length, 2);
  db.close();
});

test('foreign player reads and writes are denied even with a valid Telegram session', async () => {
  const db = new D1Database(), env = envFor(db);
  await handler(request('/players/me', { method: 'POST', userId: '42' }), env);
  await handler(request('/players/me', { method: 'POST', userId: '77' }), env);
  const read = await handler(request('/players/77', { userId: '42' }), env);
  const write = await handler(request('/players/77', { method: 'PUT', userId: '42', body: { economy: { coins: 999 } } }), env);
  assert.equal(read.status, 403);
  assert.equal(write.status, 403);
  db.close();
});

test('only the configured owner can read the global player list', async () => {
  const db = new D1Database(), env = envFor(db);
  await handler(request('/players/me', { method: 'POST', userId: '42' }), env);
  await handler(request('/players/me', { method: 'POST', userId: '77' }), env);
  await handler(request('/players/me', { method: 'POST', userId: '1328706856' }), env);
  const ordinary = await handler(request('/players', { userId: '42' }), env);
  assert.equal(ordinary.status, 403);
  const owner = await handler(request('/players', { userId: '1328706856' }), env);
  assert.equal(owner.status, 200);
  assert.deepEqual((await owner.json()).players.map(item => item.telegramId).sort(), ['1328706856', '42', '77']);
  db.close();
});

test('shop price and ownership are server authoritative', async () => {
  const db = new D1Database(), env = envFor(db);
  await handler(request('/players/me', { method: 'POST', userId: '42' }), env);
  await handler(request('/admin/actions', { method: 'POST', userId: '1328706856', body: { id: 'admin:seed:42', action: 'currency_granted', targetPlayerId: '42', operation: 'currency', amount: 100, currencyType: 'coins', reason: 'test' } }), env);
  const wrongPrice = await handler(request('/transactions', { method: 'POST', userId: '42', body: { id: 'shop:bad', currencyType: 'coins', type: 'spend', amount: 1, source: 'teleplay-shop', metadata: { itemId: 'avatar-frame-cyber', scope: 'profile' } } }), env);
  assert.equal(wrongPrice.status, 400);
  assert.equal((await wrongPrice.json()).error, 'invalid_shop_price');
  const purchase = await handler(request('/transactions', { method: 'POST', userId: '42', body: { id: 'shop:good', currencyType: 'coins', type: 'spend', amount: 70, source: 'teleplay-shop', metadata: { itemId: 'avatar-frame-cyber', scope: 'profile' } } }), env);
  assert.equal(purchase.status, 201);
  const repeated = await handler(request('/transactions', { method: 'POST', userId: '42', body: { id: 'shop:good-2', currencyType: 'coins', type: 'spend', amount: 70, source: 'teleplay-shop', metadata: { itemId: 'avatar-frame-cyber', scope: 'profile' } } }), env);
  assert.equal(repeated.status, 409);
  assert.equal((await repeated.json()).error, 'item_already_owned');
  db.close();
});

test('non-shop transaction metadata cannot unlock inventory items', async () => {
  const db = new D1Database(), env = envFor(db);
  await handler(request('/players/me', { method: 'POST', userId: '42' }), env);
  await handler(request('/admin/actions', { method: 'POST', userId: '1328706856', body: { id: 'admin:seed:inventory', action: 'currency_granted', targetPlayerId: '42', operation: 'currency', amount: 10, currencyType: 'coins', reason: 'test' } }), env);
  const spend = await handler(request('/transactions', { method: 'POST', userId: '42', body: { id: 'system:metadata', currencyType: 'coins', type: 'spend', amount: 1, source: 'system', metadata: { itemId: 'premium-legend-badge' } } }), env);
  assert.equal(spend.status, 201);
  const synced = await handler(request('/players/me/state', { method: 'PUT', userId: '42', body: { inventory: { profile: { ownedItems: ['premium-legend-badge'], equippedItems: {}, purchaseHistory: [] }, games: {} } } }), env);
  assert.equal(synced.status, 200);
  assert.deepEqual((await synced.json()).player.inventory.profile.ownedItems, ['avatar-frame-neon']);
  db.close();
});

test('game sessions validate game, score, time and session ownership', async () => {
  const db = new D1Database(), env = envFor(db);
  await handler(request('/players/me', { method: 'POST', userId: '42' }), env);
  await handler(request('/players/me', { method: 'POST', userId: '77' }), env);
  const invalidScore = await handler(request('/game-sessions', { method: 'POST', userId: '42', body: { id: 'session:bad-score', gameId: 'neon-race', score: 999999, duration: 1000, startedAt: Date.now() } }), env);
  assert.equal(invalidScore.status, 400);
  assert.equal((await invalidScore.json()).error, 'invalid_game_score');
  const started = await handler(request('/game-sessions', { method: 'POST', userId: '42', body: { id: 'session:owned', gameId: 'neon-race', result: { event: 'started' }, startedAt: Date.now() } }), env);
  assert.equal(started.status, 201);
  const foreign = await handler(request('/game-sessions', { method: 'POST', userId: '77', body: { id: 'session:owned', gameId: 'neon-race', score: 5, duration: 100, startedAt: Date.now() - 1000, finishedAt: Date.now() } }), env);
  assert.equal(foreign.status, 409);
  assert.equal((await foreign.json()).error, 'session_id_conflict');
  db.close();
});

test('server reward proof validates a finished session and is idempotent', async () => {
  const db = new D1Database(), env = envFor(db), userId = '42';
  await handler(request('/players/me', { method: 'POST', userId }), env);
  const startedAt = Date.now() - 1500, finishedAt = Date.now();
  const start = await handler(request('/game-sessions', { method: 'POST', userId, body: { id: 'session:reward-proof', gameId: 'neon-hook', result: { event: 'started' }, startedAt } }), env);
  assert.equal(start.status, 201);
  const finish = await handler(request('/game-sessions', { method: 'POST', userId, body: { id: 'session:reward-proof', gameId: 'neon-hook', score: 500, duration: 1000, startedAt, finishedAt, result: { event: 'finished', score: 500, completed: true, progress: 100 } } }), env);
  assert.equal(finish.status, 200);
  const submitted = await handler(request('/games/result', { method: 'POST', userId, body: { playerId: userId, gameId: 'neon-hook', sessionId: 'session:reward-proof', score: 500, duration: 1000, timestamp: finishedAt, metadata: { completed: true, progress: 100 } } }), env);
  assert.equal(submitted.status, 201);
  const firstBody = await submitted.json();
  assert.equal(firstBody.rewardProof.status, 'issued');
  assert.equal(firstBody.rewardProof.rewardData.coins, 10);
  assert.equal(firstBody.rewardProof.rewardData.xp, 12);
  assert.equal(firstBody.player.economy.coins, 10);
  const repeated = await handler(request('/games/result', { method: 'POST', userId, body: { playerId: userId, gameId: 'neon-hook', sessionId: 'session:reward-proof', score: 500, duration: 1000, timestamp: finishedAt, metadata: { completed: true } } }), env);
  assert.equal(repeated.status, 200);
  assert.equal((await repeated.json()).duplicate, true);
  const economy = db.sqlite.prepare('SELECT coins FROM economy WHERE player_id = ?').get(userId);
  const transactions = db.sqlite.prepare("SELECT COUNT(*) AS count FROM transactions WHERE player_id = ? AND source = 'game'").get(userId);
  const proofs = db.sqlite.prepare('SELECT COUNT(*) AS count FROM reward_proofs WHERE player_id = ?').get(userId);
  assert.equal(economy.coins, 10);
  assert.equal(transactions.count, 1);
  assert.equal(proofs.count, 1);
  db.close();
});

test('server rejects impossible results and records a fraud event', async () => {
  const db = new D1Database(), env = envFor(db), userId = '77', startedAt = Date.now() - 1000, finishedAt = Date.now();
  await handler(request('/players/me', { method: 'POST', userId }), env);
  const opened = await handler(request('/game-sessions', { method: 'POST', userId, body: { id: 'session:fraud', gameId: 'neon-race', startedAt, result: { event: 'started' } } }), env);
  assert.equal(opened.status, 201);
  const session = await handler(request('/game-sessions', { method: 'POST', userId, body: { id: 'session:fraud', gameId: 'neon-race', score: 100000, duration: 100, startedAt, finishedAt, result: { event: 'finished', score: 100000 } } }), env);
  assert.equal(session.status, 200);
  const rejected = await handler(request('/games/result', { method: 'POST', userId, body: { gameId: 'neon-race', sessionId: 'session:fraud', score: 100000, duration: 100, timestamp: finishedAt } }), env);
  assert.equal(rejected.status, 422);
  assert.equal((await rejected.json()).error, 'result_rejected');
  const fraud = await handler(request('/fraud-events', { userId: '1328706856' }), env);
  assert.equal(fraud.status, 200);
  assert.equal((await fraud.json()).events.length, 1);
  db.close();
});

test('analytics idempotency cannot leak or reuse another player id', async () => {
  const db = new D1Database(), env = envFor(db);
  await handler(request('/players/me', { method: 'POST', userId: '42' }), env);
  await handler(request('/players/me', { method: 'POST', userId: '77' }), env);
  const first = await handler(request('/analytics/events', { method: 'POST', userId: '42', body: { id: 'event:shared', event: 'game_started', metadata: {} } }), env);
  assert.equal(first.status, 201);
  const foreign = await handler(request('/analytics/events', { method: 'POST', userId: '77', body: { id: 'event:shared', event: 'spoof', metadata: {} } }), env);
  assert.equal(foreign.status, 409);
  assert.equal((await foreign.json()).error, 'event_id_conflict');
  db.close();
});

test('Telegram payment invoices are server-priced and Gems settle once from webhook confirmation', async () => {
  const db = new D1Database();
  const packages = [{ id: 'gem-pack-small', name: 'Small Pack', description: '100 TeleGems', gemsAmount: 100, bonus: 10, starsPrice: 100, currency: 'XTR', provider: 'telegram_stars', active: true }];
  const env = envFor(db, { TELEPLAY_PAYMENT_PACKAGES: JSON.stringify(packages), TELEPLAY_PAYMENT_WEBHOOK_SECRET: 'test-webhook' });
  await handler(request('/players/me', { method: 'POST', userId: '42' }), env);
  const packageResponse = await handler(request('/payments/packages', { userId: '42' }), env);
  assert.deepEqual((await packageResponse.json()).packages[0], { id: 'gem-pack-small', name: 'Small Pack', description: '100 TeleGems', gemsAmount: 100, bonus: 10, totalGems: 110, amount: 100, currency: 'XTR', provider: 'telegram_stars' });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url, options) => {
    const body = JSON.parse(options.body);
    if (body.pre_checkout_query_id) return new Response(JSON.stringify({ ok: true, result: true }), { status: 200 });
    return new Response(JSON.stringify({ ok: true, result: 'https://t.me/invoice/test' }), { status: 200 });
  };
  try {
    const invoice = await handler(request('/payments/invoice', { method: 'POST', userId: '42', body: { packageId: 'gem-pack-small', amount: 999999 }, headers: { 'X-Idempotency-Key': 'payment-key-1' } }), env);
    assert.equal(invoice.status, 201);
    const invoiceBody = await invoice.json();
    assert.equal(invoiceBody.payment.status, 'pending');
    assert.equal(invoiceBody.payment.amount, 100);
    assert.equal(invoiceBody.payment.gemsAmount, 110);
    const pending = invoiceBody.payment;
    const preCheckout = await handler(request('/telegram/payments/webhook', { method: 'POST', body: { pre_checkout_query: { id: 'pre-1', from: { id: 42 }, invoice_payload: pending.invoicePayload, currency: 'XTR', total_amount: 100 } }, headers: { 'X-Telegram-Bot-Api-Secret-Token': 'test-webhook' } }), env);
    assert.equal(preCheckout.status, 200);
    assert.equal((await preCheckout.json()).accepted, true);
    const successfulUpdate = { update_id: 1, message: { from: { id: 42 }, successful_payment: { invoice_payload: pending.invoicePayload, currency: 'XTR', total_amount: 100, telegram_payment_charge_id: 'charge-1', provider_payment_charge_id: 'provider-1' } } };
    const completed = await handler(request('/telegram/payments/webhook', { method: 'POST', body: successfulUpdate, headers: { 'X-Telegram-Bot-Api-Secret-Token': 'test-webhook' } }), env);
    assert.equal(completed.status, 200);
    assert.equal((await completed.json()).payment.status, 'completed');
    const duplicate = await handler(request('/telegram/payments/webhook', { method: 'POST', body: successfulUpdate, headers: { 'X-Telegram-Bot-Api-Secret-Token': 'test-webhook' } }), env);
    assert.equal(duplicate.status, 200);
    assert.equal((await duplicate.json()).duplicate, true);
    const player = await handler(request('/players/me', { userId: '42' }), env);
    assert.equal((await player.json()).player.economy.gems, 110);
    assert.equal(db.sqlite.prepare("SELECT COUNT(*) AS count FROM transactions WHERE player_id = '42' AND source = 'payment'").get().count, 1);
    assert.equal(db.sqlite.prepare("SELECT COUNT(*) AS count FROM analytics_events WHERE player_id = '42' AND event = 'first_payment_completed'").get().count, 1);
    const ownerPayments = await handler(request('/payments', { userId: '1328706856' }), env);
    assert.equal(ownerPayments.status, 200);
    const ownerPaymentBody = await ownerPayments.json();
    assert.equal(ownerPaymentBody.payments.length, 1);
    const compensation = await handler(request('/admin/actions', { method: 'POST', userId: '1328706856', body: { id: 'admin:payment-compensation', action: 'payment_compensation', operation: 'payment_compensation', targetPlayerId: '42', paymentId: ownerPaymentBody.payments[0].id, amount: 25, reason: 'support correction' } }), env);
    assert.equal(compensation.status, 201);
    assert.equal((await compensation.json()).transaction.balanceAfter, 135);
    const ordinaryPayments = await handler(request('/payments', { userId: '42' }), env);
    assert.equal(ordinaryPayments.status, 403);
    const forged = { ...successfulUpdate, message: { ...successfulUpdate.message, successful_payment: { ...successfulUpdate.message.successful_payment, total_amount: 999 } } };
    const forgedResponse = await handler(request('/telegram/payments/webhook', { method: 'POST', body: forged, headers: { 'X-Telegram-Bot-Api-Secret-Token': 'test-webhook' } }), env);
    assert.equal(forgedResponse.status, 400);
    assert.equal(db.sqlite.prepare("SELECT COUNT(*) AS count FROM analytics_events WHERE player_id = '42' AND event = 'first_payment_completed'").get().count, 1);
  } finally {
    globalThis.fetch = originalFetch;
    db.close();
  }
});
