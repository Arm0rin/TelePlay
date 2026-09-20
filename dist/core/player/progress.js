(() => {
  const values = () => window.TelePlayPlayer.ProgressionConfig.XP;
  const ranks = () => window.TelePlayPlayer.ProgressionConfig.RANKS;
  const tiers = () => window.TelePlayPlayer.ProgressionConfig.LEVEL_TIERS;
  const XP_REWARDS = Object.freeze({ gameStarted: 50, gameFinished: 25, newRecord: 100, levelCompleted: 40, achievement: 100 });
  function xpRequiredForLevel(level) { const config = values(); return Math.ceil(config.baseRequired * Math.pow(Math.max(1, level), config.exponent)); }
  function levelForXP(totalXP = 0) { const xp = Math.max(0, Number(totalXP) || 0), config = values(); let level = 1, spent = 0; while (level < config.maxLevel) { const cost = xpRequiredForLevel(level); if (xp < spent + cost) break; spent += cost; level += 1; } return level; }
  function rankForLevel(level = 1) { const available = ranks().filter(rank => level >= rank.level); return available[available.length - 1] || ranks()[0]; }
  function tierForLevel(level = 1) { const available = tiers().filter(tier => level >= tier.level); return available[available.length - 1] || tiers()[0]; }
  function snapshot(totalXP = 0) { const xp = Math.max(0, Number(totalXP) || 0), config = values(), level = levelForXP(xp); let spent = 0; for (let current = 1; current < level; current += 1) spent += xpRequiredForLevel(current); const nextXP = level >= config.maxLevel ? 0 : xpRequiredForLevel(level), currentXP = xp - spent; return { level, xp: currentXP, totalXP: xp, currentXP, nextXP, progress: nextXP ? Math.min(100, Math.round(currentXP / nextXP * 100)) : 100, tier: tierForLevel(level), rank: rankForLevel(level) }; }
  window.TelePlayPlayer ??= {};
  window.TelePlayPlayer.Progress = { XP_REWARDS, xpRequiredForLevel, levelForXP, rankForLevel, tierForLevel, snapshot };
})();
