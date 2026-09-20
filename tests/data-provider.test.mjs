import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const modelSource = await readFile(new URL('../dist/core/player-model.js', import.meta.url), 'utf8');
const providerSource = await readFile(new URL('../dist/core/data-provider.js', import.meta.url), 'utf8');

const player = (overrides = {}) => ({
  telegramId: '42', username: 'reef_ru', firstName: 'Reef', createdAt: 1, lastActive: 2,
  progress: { level: 2, xp: 20, totalXP: 120, rank: 'rookie', achievements: [], streak: {} },
  economy: { coins: 10, gems: 2 }, inventory: { profile: { ownedItems: ['avatar-frame-neon'], equippedItems: {}, purchaseHistory: [] }, games: {} },
  statistics: { totalGames: 1 }, records: {}, state: {}, ...overrides
});

const jsonResponse = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function harness({ mode = 'backend', initial = {}, fetchImpl } = {}) {
  let saved = structuredClone(initial), fetchCalls = [];
  const window = {
    TelePlayDataConfig: {
      mode, backendUrl: 'https://api.teleplay.test', allowLocalFallback: true,
      requestTimeoutMs: 200, healthTimeoutMs: 100, syncDebounceMs: 5,
      endpoints: { health: '/health', me: '/players/me', meImport: '/players/me/import', meState: '/players/me/state', players: '/players', transactions: '/transactions', gameSessions: '/game-sessions', analytics: '/analytics/events', adminActions: '/admin/actions' }
    },
    TelePlayCore: {
      SaveManager: { read: () => structuredClone(saved), write: value => (saved = structuredClone(value)) },
      TelegramAuth: { identity: () => ({ authenticated: true, telegramId: '42' }), initData: () => 'signed-init-data', headers: extra => ({ Accept: 'application/json', 'X-Telegram-Init-Data': 'signed-init-data', ...extra }) }
    },
    dispatchEvent() {}
  };
  const fetch = async (url, options = {}) => {
    fetchCalls.push({ url, options });
    if (!fetchImpl) throw new Error('Unexpected fetch');
    return fetchImpl(new URL(url), options, fetchCalls);
  };
  const context = vm.createContext({ window, fetch, Response, URL, URLSearchParams, AbortController, CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options?.detail; } }, setTimeout, clearTimeout, structuredClone, console, Date, Math, JSON, Object, Array, String, Number, Boolean, Promise, Error, Map, Set });
  vm.runInContext(modelSource, context, { filename: 'player-model.js' });
  vm.runInContext(providerSource, context, { filename: 'data-provider.js' });
  return { provider: window.TelePlayCore.DataProvider, calls: fetchCalls, saved: () => structuredClone(saved) };
}

test('local mode initializes without contacting API', async () => {
  const app = harness({ mode: 'local', initial: { coins: 7 } });
  const result = await app.provider.initialize();
  assert.equal(result.status, 'local');
  assert.equal(app.provider.isBackendActive(), false);
  assert.equal(app.calls.length, 0);
  assert.equal(app.saved().coins, 7);
});

test('backend mode health-checks and hydrates an existing player', async () => {
  const app = harness({ fetchImpl: url => url.pathname === '/health' ? jsonResponse({ status: 'ok' }) : jsonResponse({ player: player() }) });
  const result = await app.provider.initialize();
  assert.equal(result.status, 'online');
  assert.equal(app.provider.isBackendActive(), true);
  assert.equal(app.saved().profile.id, '42');
  assert.equal(app.saved().coins, 10);
  assert.deepEqual(app.calls.map(call => new URL(call.url).pathname), ['/health', '/players/me']);
});

test('a missing player is created with safe server defaults', async () => {
  const app = harness({ fetchImpl: (url, options) => {
    if (url.pathname === '/health') return jsonResponse({ status: 'ok' });
    if (url.pathname === '/players/me' && options.method === 'GET') return jsonResponse({ error: 'player_not_found' }, 404);
    if (url.pathname === '/players/me' && options.method === 'POST') return jsonResponse({ player: player({ economy: { coins: 0, gems: 0 } }), created: true }, 201);
    return jsonResponse({ error: 'unexpected' }, 500);
  } });
  const result = await app.provider.initialize();
  assert.equal(result.created, true);
  assert.equal(app.provider.isBackendActive(), true);
  assert.equal(app.saved().coins, 0);
});

test('meaningful local progress is imported silently during first server bootstrap', async () => {
  const initial = { coins: 90, gems: 3, progress: { level: 4, totalXP: 420 }, profile: { id: '42' }, inventory: { profile: { ownedItems: ['avatar-frame-neon'] }, games: {} } };
  const app = harness({ initial, fetchImpl: (url, options) => {
    if (url.pathname === '/health') return jsonResponse({ status: 'ok' });
    if (url.pathname === '/players/me' && options.method === 'GET') return jsonResponse({ error: 'player_not_found' }, 404);
    if (url.pathname === '/players/me' && options.method === 'POST') return jsonResponse({ player: player({ economy: { coins: 0, gems: 0 } }), created: true }, 201);
    if (url.pathname === '/players/me/import') return jsonResponse({ player: player({ economy: { coins: 0, gems: 0 }, progress: { level: 4, xp: 420, totalXP: 420, rank: 'rookie', achievements: [], streak: {} } }), imported: true, migrationCompleted: true }, 201);
    return jsonResponse({ error: 'unexpected' }, 500);
  } });
  const result = await app.provider.initialize();
  assert.equal(result.status, 'online');
  assert.equal(result.created, true);
  assert.equal(result.migrated, true);
  assert.equal(app.provider.isBackendActive(), true);
  assert.equal(app.saved().coins, 0);
  assert.equal(app.saved().progress.level, 4);
  assert.ok(app.calls.some(call => new URL(call.url).pathname === '/players/me/import'));
});

test('API outage falls back without deleting the local save', async () => {
  const app = harness({ initial: { coins: 55 }, fetchImpl: () => { throw new TypeError('network down'); } });
  const result = await app.provider.initialize();
  assert.equal(result.status, 'fallback');
  assert.equal(app.provider.status().phase, 'offline');
  assert.equal(app.saved().coins, 55);
});

test('strict admin player reads bypass a temporary local fallback', async () => {
  let online = false;
  const app = harness({ initial: { profile: { id: '42', username: 'reef_ru' } }, fetchImpl: url => {
    if (!online) throw new TypeError('network down');
    if (url.pathname === '/players') return jsonResponse({ players: [player(), player({ telegramId: '77', username: 'second-player', firstName: 'Second' })] });
    return jsonResponse({ error: 'unexpected' }, 500);
  } });
  assert.equal((await app.provider.initialize()).status, 'fallback');
  online = true;
  const players = await app.provider.listPlayers({ strict: true });
  assert.equal(players.length, 2);
  assert.deepEqual(players.map(item => item.telegramId).sort(), ['42', '77']);
  assert.ok(app.calls.some(call => new URL(call.url).pathname === '/players'));
  assert.equal(app.provider.isBackendActive(), false);
});

test('active backend debounces player state sync', async () => {
  const app = harness({ fetchImpl: (url, options) => {
    if (url.pathname === '/health') return jsonResponse({ status: 'ok' });
    if (url.pathname === '/players/me' && options.method === 'GET') return jsonResponse({ player: player() });
    if (url.pathname === '/players/me/state' && options.method === 'PUT') return jsonResponse({ player: player({ statistics: { totalGames: 2 } }), synced: true });
    return jsonResponse({ error: 'unexpected' }, 500);
  } });
  await app.provider.initialize();
  app.provider.savePlayer({ ...app.saved(), statistics: { totalGames: 2 } });
  await new Promise(resolve => setTimeout(resolve, 30));
  assert.ok(app.calls.some(call => new URL(call.url).pathname === '/players/me/state' && call.options.method === 'PUT'));
  assert.equal(app.saved().statistics.totalGames, 2);
});

test('purchase transaction reaches server before equipped inventory state', async () => {
  const order = [];
  const app = harness({ fetchImpl: async (url, options) => {
    if (url.pathname === '/health') return jsonResponse({ status: 'ok' });
    if (url.pathname === '/players/me' && options.method === 'GET') return jsonResponse({ player: player() });
    if (url.pathname === '/transactions') { order.push('transaction:start'); await new Promise(resolve => setTimeout(resolve, 15)); order.push('transaction:done'); return jsonResponse({ balance: 5 }); }
    if (url.pathname === '/players/me/state') { order.push('state'); return jsonResponse({ player: player({ economy: { coins: 5, gems: 2 }, inventory: { profile: { ownedItems: ['avatar-frame-neon', 'cyber-frame'], equippedItems: { frame: 'cyber-frame' }, purchaseHistory: [] }, games: {} } }), synced: true }); }
    return jsonResponse({ error: 'unexpected' }, 500);
  } });
  await app.provider.initialize();
  void app.provider.recordTransaction({ id: 'teleplay-shop:item:cyber-frame', currencyType: 'coins', type: 'spend', amount: -5, source: 'teleplay-shop', metadata: { itemId: 'cyber-frame' } });
  app.provider.savePlayer({ ...app.saved(), coins: 5, inventory: { profile: { ownedItems: ['avatar-frame-neon', 'cyber-frame'], equippedItems: { frame: 'cyber-frame' }, purchaseHistory: [] }, games: {} } });
  await new Promise(resolve => setTimeout(resolve, 45));
  assert.deepEqual(order, ['transaction:start', 'transaction:done', 'state']);
  assert.equal(app.saved().inventory.profile.equippedItems.frame, 'cyber-frame');
});

test('offline changes are queued and replayed before returning to backend mode', async () => {
  let online = false;
  const replayed = [];
  const app = harness({ initial: { profile: { id: '42' }, coins: 0 }, fetchImpl: (url, options) => {
    if (!online) throw new TypeError('offline');
    if (url.pathname === '/health') return jsonResponse({ status: 'ok' });
    if (url.pathname === '/players/me' && options.method === 'GET') return jsonResponse({ player: player({ economy: { coins: 0, gems: 0 } }) });
    if (url.pathname === '/transactions') { replayed.push('transaction'); return jsonResponse({ balance: 12 }); }
    if (url.pathname === '/analytics/events') { replayed.push('analytics'); return jsonResponse({ event: { id: 'event:offline' } }, 201); }
    if (url.pathname === '/game-sessions') { replayed.push('session'); return jsonResponse({ session: { id: 'session:offline' } }, 201); }
    if (url.pathname === '/players/me/state') { replayed.push('state'); return jsonResponse({ player: player({ economy: { coins: 12, gems: 0 }, statistics: { totalGames: 2 } }), synced: true }); }
    return jsonResponse({ error: 'unexpected' }, 500);
  } });
  assert.equal((await app.provider.initialize()).status, 'fallback');
  app.provider.savePlayer({ ...app.saved(), coins: 12, statistics: { totalGames: 2 } });
  await app.provider.recordTransaction({ id: 'reward:offline', currencyType: 'coins', type: 'earn', amount: 12, source: 'reward', metadata: {} });
  app.provider.recordAnalyticsEvent({ id: 'event:offline', event: 'game_finished', timestamp: Date.now(), metadata: { gameId: 'neon-race' } });
  await app.provider.recordGameSession({ id: 'session:offline', gameId: 'neon-race', startedAt: 1, finishedAt: 2, score: 10, duration: 1, result: {} });
  assert.equal(app.saved().serverSync.pending, true);
  online = true;
  const result = await app.provider.retry();
  assert.equal(result.status, 'online');
  assert.equal(app.provider.isBackendActive(), true);
  assert.deepEqual(replayed, ['transaction', 'analytics', 'session', 'state']);
  assert.equal(app.saved().serverSync.pending, false);
});

test('server-rejected rewards are not retried forever or force local fallback', async () => {
  const app = harness({ fetchImpl: (url, options) => {
    if (url.pathname === '/health') return jsonResponse({ status: 'ok' });
    if (url.pathname === '/players/me' && options.method === 'GET') return jsonResponse({ player: player() });
    if (url.pathname === '/transactions') return jsonResponse({ error: 'server_reward_required' }, 403);
    if (url.pathname === '/players/me/state') return jsonResponse({ player: player(), synced: true });
    return jsonResponse({ error: 'unexpected' }, 500);
  } });
  await app.provider.initialize();
  await app.provider.recordTransaction({ id: 'reward:rejected', currencyType: 'coins', type: 'earn', amount: 25, source: 'reward', metadata: {} });
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(app.saved().serverSync.pendingTransactions?.length || 0, 0);
  assert.equal(app.saved().serverSync.pending, false);
});
