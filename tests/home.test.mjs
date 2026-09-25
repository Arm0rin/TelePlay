import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const source = await readFile(new URL('../dist/core/player/home.js', import.meta.url), 'utf8');

function home() {
  const window = { TelePlayPlayer: {} };
  vm.runInContext(source, vm.createContext({ window, Date, Math }), { filename: 'home.js' });
  return window.TelePlayPlayer.Home;
}

const games = [{ id: 'neon-race', status: 'available' }];

test('starter route guides a new player through launch, finish, and first record', () => {
  const route = home().starterRoute({ statistics: { totalGames: 0, gamesPlayed: 0, bestResults: {} }, records: {} }, games, '2026-09-21');
  assert.equal(route.activeStep.id, 'first_launch');
  assert.equal(route.complete, false);
  assert.equal(route.targetGame.id, 'neon-race');
});

test('starter route advances only when game lifecycle milestones are completed', () => {
  const playerHome = home();
  const afterLaunch = playerHome.starterRoute({ statistics: { totalGames: 1, gamesPlayed: 0, bestResults: {} } }, games);
  const afterFinish = playerHome.starterRoute({ statistics: { totalGames: 1, gamesPlayed: 1, bestResults: {} } }, games);
  const complete = playerHome.starterRoute({ statistics: { totalGames: 1, gamesPlayed: 1, bestResults: { 'neon-race': 42 } } }, games);
  assert.equal(afterLaunch.activeStep.id, 'first_finish');
  assert.equal(afterFinish.activeStep.id, 'first_record');
  assert.equal(complete.complete, true);
});
