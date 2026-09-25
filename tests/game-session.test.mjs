import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const source = await readFile(new URL('../dist/core/game-session.js', import.meta.url), 'utf8');

test('game lifecycle keeps one gameSessionId from start through finish', () => {
  const events = [], playerEvents = [], logEvents = [];
  const window = {
    TelePlayCore: {
      DataProvider: { isBackendEnabled: () => false },
      PlayerData: { handleEvent: (event, gameId, detail) => playerEvents.push({ event, gameId, detail }) }
    },
    TelePlayAdminLog: { recordEvent: (event, gameId, detail) => logEvents.push({ event, gameId, detail }) },
    dispatchEvent: event => events.push(event.detail),
    dataLayer: { push() {} }
  };
  const context = vm.createContext({ window, Date, Math, Promise, Map, Set, Error, CustomEvent: class { constructor(_type, options) { this.detail = options?.detail; } } });
  vm.runInContext(source, context, { filename: 'game-session.js' });
  const session = window.TelePlayCore.GameSession;
  const started = session.handleEvent('game_started', 'neon-race', { score: 0 });
  const finished = session.handleEvent('game_finished', 'neon-race', { score: 120 });
  assert.match(started.gameSessionId, /^session:neon-race:/);
  assert.equal(finished.gameSessionId, started.gameSessionId);
  assert.ok(finished.durationMs >= 0);
  assert.equal(playerEvents[1].detail.gameSessionId, started.gameSessionId);
  assert.equal(logEvents[1].detail.gameSessionId, started.gameSessionId);
  assert.equal(events[1].gameSessionId, started.gameSessionId);
});
