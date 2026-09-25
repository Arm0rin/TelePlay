import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const source = await readFile(new URL('../dist/core/analytics.js', import.meta.url), 'utf8');

function harness() {
  const events = [], storage = new Map();
  const window = {
    location: { search: '?startapp=creator_a' },
    innerWidth: 390,
    innerHeight: 844,
    navigator: { language: 'ru-RU' },
    Telegram: { WebApp: { platform: 'ios', version: '8.0', colorScheme: 'dark', viewportStableWidth: 390, viewportStableHeight: 760, initDataUnsafe: { start_param: 'telegram_campaign', user: { id: 42, username: 'must-not-be-sent' } } } },
    TelePlayCore: { GameSession: { handleEvent: (event, gameId, detail) => { events.push({ event, gameId, detail }); return { event, gameId, ...detail }; } } },
    dispatchEvent() {},
    dataLayer: { push() {} }
  };
  const context = vm.createContext({ window, sessionStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) }, URLSearchParams, Date, Math, String, Number, Object, Array, Boolean });
  vm.runInContext(source, context, { filename: 'analytics.js' });
  return { analytics: window.TelePlayCore.Analytics, events };
}

test('analytics adds a stable launch context without Telegram identity data', () => {
  const app = harness();
  app.analytics.appOpened({ source: 'bootstrap' });
  app.analytics.gameStarted('neon-race', { score: 5 });
  assert.equal(app.events.length, 2);
  const [opened, started] = app.events;
  assert.equal(opened.event, 'app_opened');
  assert.equal(opened.detail.telemetry.schemaVersion, '2026-09');
  assert.equal(opened.detail.telemetry.platform, 'ios');
  assert.equal(opened.detail.telemetry.startParam, 'telegram_campaign');
  assert.equal(opened.detail.telemetry.launchSessionId, started.detail.telemetry.launchSessionId);
  assert.equal(JSON.stringify(opened.detail).includes('must-not-be-sent'), false);
  assert.equal(started.gameId, 'neon-race');
});

test('analytics bounds untrusted metadata before it reaches the event pipeline', () => {
  const app = harness();
  app.analytics.track('custom_event', null, { long: 'x'.repeat(500), list: ['discarded'], nested: { value: 1, deep: { keep: true, tooDeep: { discarded: true } } } });
  const detail = app.events[0].detail;
  assert.equal(detail.long.length, 160);
  assert.equal('list' in detail, false);
  assert.equal(detail.nested.value, 1);
  assert.equal(detail.nested.deep.tooDeep, undefined);
});
