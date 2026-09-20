(() => {
  const config = () => window.TelePlayPlayer.ProgressionConfig;
  const genreKeys = () => Object.keys(config().GENRES);
  function required(level) { const values = config().MASTERY; return Math.ceil(values.baseRequired * Math.pow(Math.max(1, level), values.exponent)); }
  function snapshot(totalXP = 0) {
    const values = config().MASTERY, total = Math.max(0, Number(totalXP) || 0); let level = 1, spent = 0;
    while (level < values.maxLevel) { const cost = required(level); if (total < spent + cost) break; spent += cost; level += 1; }
    const next = level >= values.maxLevel ? 0 : required(level);
    return { level, totalXP: total, currentXP: total - spent, nextXP: next, progress: next ? Math.min(100, Math.round((total - spent) / next * 100)) : 100 };
  }
  function normalized(input = {}) { const value = {}; genreKeys().forEach(key => { const state = input[key] || {}; const snap = snapshot(state.totalXP || state.xp || 0); value[key] = { totalXP: snap.totalXP, level: snap.level }; }); return value; }
  function genreFor(gameId) {
    const fixed = config().GAME_GENRES[gameId]; if (fixed) return fixed;
    const category = window.TelePlayCatalog?.games?.find(game => game.id === gameId)?.category;
    return category === 'racing' ? 'racing' : category === 'sport' ? 'sports' : category === 'puzzle' || category === 'logic' ? 'puzzle' : 'arcade';
  }
  window.TelePlayPlayer ??= {};
  window.TelePlayPlayer.Mastery = { required, snapshot, normalized, genreFor, genreKeys };
})();
