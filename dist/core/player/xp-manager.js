(() => {
  const config = () => window.TelePlayPlayer.ProgressionConfig;
  const dayBefore = date => { const value = new Date(`${date}T00:00:00.000Z`); value.setUTCDate(value.getUTCDate() - 1); return value.toISOString().slice(0, 10); };
  function dailyBonus(activity = {}, date, streakState = {}) {
    const daily = activity.daily || {}, previous = daily.lastActiveDate || null, canonicalDate = streakState.lastActiveDate || null, canonicalStreak = Number(streakState.currentStreak || streakState.streak || 0);
    if (previous === date) return { isFirstToday: false, streak: Math.max(1, canonicalDate === date ? canonicalStreak : 1), xp: 0, next: daily };
    const continued = previous === dayBefore(date), streak = canonicalDate === date && canonicalStreak > 0 ? canonicalStreak : continued ? Math.max(1, canonicalDate === dayBefore(date) ? canonicalStreak : Number(daily.streak || 1)) + 1 : 1;
    const values = config().XP, xp = values.dailyFirstLaunch + (streak > 1 ? Math.min(7, streak - 1) * values.streakStep : 0);
    return { isFirstToday: true, streak, xp, next: { lastActiveDate: date } };
  }
  function isGoodResult(gameId, result = {}) {
    const threshold = Number(config().GOOD_RESULT_SCORES[gameId] || 500);
    return Number(result.score || 0) >= threshold || Number(result.goals || 0) >= 3 || Number(result.progress || 0) >= 75;
  }
  function comboBonus(result = {}) { const combo = Math.max(0, Number(result.maxCombo || result.combo || 0)); return combo >= 3 ? Math.min(3, combo - 2) * config().XP.comboStep : 0; }
  function finishRewards(gameId, result = {}) {
    const values = config().XP, rewards = [{ amount: values.gameFinished, source: 'game_finished' }];
    if (isGoodResult(gameId, result)) rewards.push({ amount: values.goodResult, source: 'good_result' });
    const combo = comboBonus(result); if (combo) rewards.push({ amount: combo, source: 'combo' });
    if (result.completed || result.levelCompleted || result.victory) rewards.push({ amount: values.victory, source: 'victory' });
    return rewards;
  }
  window.TelePlayPlayer ??= {};
  window.TelePlayPlayer.XPManager = { dailyBonus, isGoodResult, comboBonus, finishRewards };
})();
