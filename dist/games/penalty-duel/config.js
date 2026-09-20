/* Penalty Duel tuning is intentionally data-first so future sports games can reuse it. */
(() => {
  const zones = [
    { id: 'top-left', label: 'Верхний левый', row: 0, col: 0, difficulty: .92, scoreMultiplier: 1.65, saveChance: .18 },
    { id: 'top', label: 'Верх', row: 0, col: 1, difficulty: .72, scoreMultiplier: 1.25, saveChance: .34 },
    { id: 'top-right', label: 'Верхний правый', row: 0, col: 2, difficulty: .92, scoreMultiplier: 1.65, saveChance: .18 },
    { id: 'left', label: 'Левый', row: 1, col: 0, difficulty: .68, scoreMultiplier: 1.2, saveChance: .36 },
    { id: 'center', label: 'Центр', row: 1, col: 1, difficulty: .35, scoreMultiplier: .85, saveChance: .7 },
    { id: 'right', label: 'Правый', row: 1, col: 2, difficulty: .68, scoreMultiplier: 1.2, saveChance: .36 },
    { id: 'bottom-left', label: 'Нижний левый', row: 2, col: 0, difficulty: .86, scoreMultiplier: 1.48, saveChance: .23 },
    { id: 'bottom', label: 'Низ', row: 2, col: 1, difficulty: .55, scoreMultiplier: 1.05, saveChance: .5 },
    { id: 'bottom-right', label: 'Нижний правый', row: 2, col: 2, difficulty: .86, scoreMultiplier: 1.48, saveChance: .23 }
  ];
  window.PenaltyDuelConfig = Object.freeze({
    id: 'penalty-duel', engineType: 'sports', seriesLength: 5, trainingShots: 3,
    gravity: 780, ballRadius: 10, shotDuration: 1.05, keeperWidth: 40,
    goal: { x: .08, y: .18, width: .84, height: .42 },
    difficulties: {
      easy: { skill: .42, reaction: .74, fakeChance: .22, diveAccuracy: .34, reach: { top: .42, mid: .68, bottom: .58 }, type: 'fast' },
      medium: { skill: .61, reaction: .56, fakeChance: .36, diveAccuracy: .55, reach: { top: .52, mid: .7, bottom: .61 }, type: 'mind' },
      hard: { skill: .79, reaction: .38, fakeChance: .5, diveAccuracy: .66, reach: { top: .58, mid: .78, bottom: .68 }, type: 'wall' }
    },
    zones
  });
})();
