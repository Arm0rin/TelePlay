(() => {
  const DAY = 86400000;
  const today = () => new Date().toISOString().slice(0, 10);
  const dateFromKey = key => new Date(`${key}T00:00:00.000Z`);
  const nextDate = key => new Date(dateFromKey(key).getTime() + DAY).toISOString().slice(0, 10);
  const yesterday = key => new Date(dateFromKey(key).getTime() - DAY).toISOString().slice(0, 10);
  const weekKey = key => { const date = dateFromKey(key), day = date.getUTCDay() || 7; date.setUTCDate(date.getUTCDate() - day + 1); return date.toISOString().slice(0, 10); };
  const nextWeek = key => new Date(dateFromKey(key).getTime() + DAY * 7).toISOString().slice(0, 10);
  const DAILY = Object.freeze([
    { id: 'daily-games-3', title: 'Сыграй 3 игры', description: 'Запусти любые игры TelePlay', metric: 'games', target: 3, rewardXP: 100, rewardCoins: 20 },
    { id: 'daily-score-1000', title: 'Набери 1000 очков', description: 'Собери очки в любых играх', metric: 'score', target: 1000, rewardXP: 75, rewardCoins: 0 },
    { id: 'daily-record', title: 'Установи новый рекорд', description: 'Побей свой лучший результат', metric: 'record', target: 1, rewardXP: 100, rewardCoins: 0 }
  ]);
  const WEEKLY = Object.freeze([
    { id: 'weekly-games-20', title: 'Игровая неделя', description: 'Сыграй 20 игровых сессий', metric: 'games', target: 20, rewardXP: 250, rewardCoins: 50 },
    { id: 'weekly-records-5', title: 'Охотник за рекордами', description: 'Получи 5 новых рекордов', metric: 'record', target: 5, rewardXP: 300, rewardCoins: 75 },
    { id: 'weekly-xp-1000', title: 'Разгон XP', description: 'Получи 1000 XP за неделю', metric: 'xp', target: 1000, rewardXP: 250, rewardCoins: 50 }
  ]);
  const STREAK_REWARDS = Object.freeze({ 3: { xp: 50, coins: 0 }, 7: { xp: 150, coins: 30 }, 30: { xp: 500, coins: 100 } });
  const blankItems = (catalog, expiresAt, type) => catalog.map(item => ({ ...item, type, progress: 0, status: 'active', expiresAt }));
  const defaultState = () => ({ daily: null, weekly: null, streak: { currentStreak: 0, bestStreak: 0, lastActiveDate: null }, streakRewards: [] });
  const read = () => window.TelePlayCore?.PlayerData?.get?.() || {};
  const save = (data, challenges) => window.TelePlayCore?.PlayerData?.set?.({ progression: { ...(data.progression || {}), challenges } });
  function ensure() {
    const data = read(), current = data.progression?.challenges || {}, date = today(), week = weekKey(date), legacyDaily = data.activity?.daily || {};
    const daily = current.daily?.date === date && Array.isArray(current.daily.items) ? current.daily : { date, expiresAt: nextDate(date), items: blankItems(DAILY, nextDate(date), 'daily') };
    const weekly = current.weekly?.weekKey === week && Array.isArray(current.weekly.items) ? current.weekly : { weekKey: week, expiresAt: nextWeek(week), items: blankItems(WEEKLY, nextWeek(week), 'weekly') };
    const legacyStreak = { currentStreak: Number(legacyDaily.currentStreak || legacyDaily.streak || 0), bestStreak: Number(legacyDaily.bestStreak || legacyDaily.currentStreak || legacyDaily.streak || 0), lastActiveDate: legacyDaily.lastActiveDate || null };
    const next = { ...defaultState(), ...current, daily, weekly, streak: { ...legacyStreak, ...(current.streak || {}) }, streakRewards: Array.isArray(current.streakRewards) ? current.streakRewards : [] };
    if (JSON.stringify(next) !== JSON.stringify(current)) save(data, next);
    return next;
  }
  const completed = items => items.filter(item => item.status === 'completed').length;
  const rewardText = item => [item.rewardXP ? `+${item.rewardXP} XP` : '', item.rewardCoins ? `+${item.rewardCoins} 🪙` : ''].filter(Boolean).join(' · ');
  function snapshot() {
    const state = ensure(), streak = state.streak || { currentStreak: 0, bestStreak: 0, lastActiveDate: null };
    return { ...state, streak, dailyCompleted: completed(state.daily.items), weeklyCompleted: completed(state.weekly.items), rewardText };
  }
  function emit(name, params = {}) { window.TelePlayCore?.Analytics?.track?.(name, null, params); }
  function award(item, type) {
    const period = item.expiresAt;
    const reward = window.TelePlayCore?.RewardManager?.award?.(`${type}_challenge`, { xp: item.rewardXP, coins: item.rewardCoins, xpSource: `${type}_challenge`, score: 0, metadata: { transactionId: `challenge:${type}:${item.id}:${period}`, challengeId: item.id, type } });
    emit('challenge_completed', { challengeId: item.id, type, rewardXP: item.rewardXP, rewardCoins: item.rewardCoins });
    if (type === 'weekly') emit('weekly_completed', { challengeId: item.id, rewardXP: item.rewardXP, rewardCoins: item.rewardCoins });
    return reward;
  }
  function update(metric, amount) {
    const value = Math.max(0, Number(amount) || 0); if (!value) return snapshot();
    const data = read(), state = ensure(), completedNow = [];
    [['daily', state.daily.items], ['weekly', state.weekly.items]].forEach(([type, items]) => items.forEach(item => {
      if (item.metric !== metric || item.status === 'completed') return;
      const before = Number(item.progress || 0); item.progress = Math.min(Number(item.target), before + value);
      if (before === 0) { item.startedAt = Date.now(); emit('challenge_started', { challengeId: item.id, type }); }
      if (item.progress >= item.target) { item.status = 'completed'; item.completedAt = Date.now(); completedNow.push({ item, type }); }
    }));
    save(data, state); completedNow.forEach(({ item, type }) => award(item, type));
    return snapshot();
  }
  function touchStreak() {
    const data = read(), state = ensure(), date = today(), daily = state.streak || {}, previous = daily.lastActiveDate || null;
    if (previous === date) return snapshot();
    const continued = previous === yesterday(date), currentStreak = continued ? Math.max(1, Number(daily.currentStreak || daily.streak || 0)) + 1 : 1, bestStreak = Math.max(Number(daily.bestStreak || 0), currentStreak);
    const nextDaily = { ...daily, lastActiveDate: date, currentStreak, bestStreak, streak: currentStreak };
    const keys = Array.isArray(state.streakRewards) ? state.streakRewards : [], reward = STREAK_REWARDS[currentStreak], key = `${currentStreak}:${date}`;
    if (previous && !continued) emit('streak_lost', { previousStreak: Number(daily.currentStreak || daily.streak || 0), currentStreak });
    const nextState = { ...state, streak: nextDaily, streakRewards: reward && !keys.includes(key) ? [...keys, key] : keys };
    save(data, nextState);
    emit('streak_extended', { currentStreak, bestStreak, continued });
    if (reward && !keys.includes(key)) window.TelePlayCore?.RewardManager?.award?.('streak', { xp: reward.xp, coins: reward.coins, xpSource: 'streak_reward', metadata: { transactionId: `streak:${key}`, streak: currentStreak, date } });
    return snapshot();
  }
  function handleEvent(event, params = {}) {
    if (event === 'game_started') update('games', 1);
    if (event === 'game_finished') update('score', Number(params.score || 0));
    if (event === 'new_record') update('record', 1);
    if (event === 'xp_received') update('xp', Number(params.amount || 0));
  }
  window.addEventListener('teleplay:game_started', event => handleEvent('game_started', event.detail || {}));
  window.addEventListener('teleplay:game_finished', event => handleEvent('game_finished', event.detail || {}));
  window.addEventListener('teleplay:new_record', event => handleEvent('new_record', event.detail || {}));
  window.addEventListener('teleplay:xp_received', event => handleEvent('xp_received', event.detail || {}));
  window.TelePlayChallenges = { DAILY, WEEKLY, STREAK_REWARDS, initialize: touchStreak, ensure, snapshot, update, touchStreak, handleEvent, rewardText };
})();
