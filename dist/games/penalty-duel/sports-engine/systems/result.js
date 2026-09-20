(() => {
  function buildResult(run, previous = {}) {
    const score = Math.floor(run.score || 0), bestScore = Math.max(Number(previous.bestScore || 0), score);
    const bestSeries = Math.max(Number(previous.bestSeries || 0), Number(run.goals || 0));
    return { ...run, score, bestScore, bestSeries, newRecord: score > Number(previous.bestScore || 0) };
  }
  window.PenaltyDuelResultSystem = { buildResult };
  window.TelePlaySportsEngine ??= {};
  window.TelePlaySportsEngine.Result = { buildResult };
})();
