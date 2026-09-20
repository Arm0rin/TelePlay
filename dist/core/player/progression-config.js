(() => {
  const XP = Object.freeze({
    maxLevel: 100,
    baseRequired: 50,
    exponent: 1.4,
    firstGameLaunch: 50,
    gameFinished: 25,
    goodResult: 50,
    newRecord: 100,
    perfectAction: 20,
    comboStep: 10,
    victory: 40,
    dailyFirstLaunch: 30,
    streakStep: 8,
    achievement: 100
  });
  const RANKS = Object.freeze([
    { level: 1, id: 'rookie', title: 'Rookie' },
    { level: 10, id: 'challenger', title: 'Challenger' },
    { level: 20, id: 'runner', title: 'Runner' },
    { level: 35, id: 'pro', title: 'Pro' },
    { level: 50, id: 'elite', title: 'Elite' },
    { level: 75, id: 'master', title: 'Master' },
    { level: 100, id: 'legend', title: 'Legend' }
  ]);
  const LEVEL_TIERS = Object.freeze([
    { level: 1, id: 'rookie', title: 'Rookie' },
    { level: 11, id: 'player', title: 'Player' },
    { level: 26, id: 'pro', title: 'Pro' },
    { level: 51, id: 'master', title: 'Master' },
    { level: 76, id: 'legend', title: 'Legend' }
  ]);
  const MASTERY = Object.freeze({ maxLevel: 50, baseRequired: 35, exponent: 1.28, gameStarted: 10, gameFinished: 18, skillAction: 8, newRecord: 14 });
  const GENRES = Object.freeze({ racing: 'Racing', arcade: 'Arcade', puzzle: 'Puzzle', sports: 'Sports' });
  const GAME_GENRES = Object.freeze({ 'neon-race': 'racing', 'block-grid': 'puzzle', 'beat-dash': 'arcade', 'neon-hook': 'arcade', 'penalty-duel': 'sports' });
  const GOOD_RESULT_SCORES = Object.freeze({ 'neon-race': 3000, 'block-grid': 500, 'beat-dash': 150, 'neon-hook': 250, 'penalty-duel': 250 });
  window.TelePlayPlayer ??= {};
  window.TelePlayPlayer.ProgressionConfig = { XP, RANKS, LEVEL_TIERS, MASTERY, GENRES, GAME_GENRES, GOOD_RESULT_SCORES };
})();
