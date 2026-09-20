(() => {
  const defaults = () => ({ gamesPlayed: 0, totalGames: 0, totalScore: 0, totalCoinsEarned: 0, totalPlayTime: 0, recordsCount: 0, totalGoals: 0, perfectActions: 0, launchesByGame: {}, bestResults: {} });
  function normalized(input = {}) { return { ...defaults(), ...input, launchesByGame: { ...defaults().launchesByGame, ...(input.launchesByGame || {}) }, bestResults: { ...defaults().bestResults, ...(input.bestResults || {}) } }; }
  function started(input, gameId) { const statistics = normalized(input), launches = { ...statistics.launchesByGame, [gameId]: Number(statistics.launchesByGame[gameId] || 0) + 1 }; return { ...statistics, totalGames: statistics.totalGames + 1, launchesByGame: launches }; }
  function finished(input, gameId, result = {}) { const statistics = normalized(input), best = Number(statistics.bestResults[gameId] || 0), score = Number(result.score || 0); return { ...statistics, gamesPlayed: statistics.gamesPlayed + 1, totalScore: statistics.totalScore + Math.max(0, score), totalPlayTime: statistics.totalPlayTime + Math.max(0, Number(result.playTime || 0)), bestResults: { ...statistics.bestResults, [gameId]: Math.max(best, score) }, recordsCount: statistics.recordsCount + (result.newRecord ? 1 : 0) }; }
  function favorite(input) { const statistics = normalized(input), entries = Object.entries(statistics.launchesByGame); return entries.sort((a, b) => b[1] - a[1])[0]?.[0] || null; }
  window.TelePlayPlayer ??= {};
  window.TelePlayPlayer.Statistics = { defaults, normalized, started, finished, favorite };
})();
