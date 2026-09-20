(() => {
  const CATALOG = Object.freeze([
    { id: 'first_game', title: 'Первый запуск', description: 'Запусти первую игру TelePlay', category: 'General', rarity: 'Common', progress: { metric: 'games', target: 1 }, rewardXP: 75, rewardCoins: 5 },
    { id: 'first_record', title: 'Первый рекорд', description: 'Установи первый личный рекорд', category: 'General', rarity: 'Rare', progress: { metric: 'records', target: 1 }, rewardXP: 120, rewardCoins: 10 },
    { id: 'marathon_100', title: 'Игровой марафон', description: 'Сыграй 100 игровых сессий', category: 'General', rarity: 'Epic', progress: { metric: 'games', target: 100 }, rewardXP: 300, rewardCoins: 35 },
    { id: 'records_50', title: 'Коллекционер рекордов', description: 'Поставь 50 личных рекордов', category: 'General', rarity: 'Legendary', progress: { metric: 'records', target: 50 }, rewardXP: 800, rewardCoins: 100 },
    { id: 'coins_10000', title: 'Неоновый капитал', description: 'Заработай 10 000 TeleCoins', category: 'General', rarity: 'Legendary', progress: { metric: 'coins', target: 10000 }, rewardXP: 650, rewardCoins: 150 },
    { id: 'speed_demon', title: 'Скоростной демон', description: 'Поставь рекорд в Неоновом заезде', category: 'Racing', rarity: 'Rare', progress: { metric: 'gameRecord', gameId: 'neon-race', target: 1 }, rewardXP: 150, rewardCoins: 20, rewardTitle: 'speed_demon' },
    { id: 'grid_master', title: 'Архитектор сетки', description: 'Набери 1 000 очков в Block Grid', category: 'Puzzle', rarity: 'Rare', progress: { metric: 'gameScore', gameId: 'block-grid', target: 1000 }, rewardXP: 150, rewardCoins: 20 },
    { id: 'arcade_perfectionist', title: 'Идеальная траектория', description: 'Сделай 25 идеальных действий', category: 'Arcade', rarity: 'Epic', progress: { metric: 'perfectActions', target: 25 }, rewardXP: 350, rewardCoins: 45, rewardTitle: 'arcade_legend' },
    { id: 'first_goal', title: 'Первый гол', description: 'Забей первый гол в Penalty Duel', category: 'Sports', rarity: 'Common', progress: { metric: 'goals', target: 1 }, rewardXP: 80, rewardCoins: 5 },
    { id: 'goal_machine', title: 'Голевая машина', description: 'Забей 500 голов', category: 'Sports', rarity: 'Legendary', progress: { metric: 'goals', target: 500 }, rewardXP: 900, rewardCoins: 150, rewardTitle: 'goal_hunter' },
    { id: 'neon_master', title: 'Neon Master', description: 'Запусти все доступные игры TelePlay', category: 'General', rarity: 'Legendary', progress: { metric: 'availableGames', target: 5 }, rewardXP: 550, rewardCoins: 75, rewardTitle: 'neon_master' }
  ]);
  const catalog = id => CATALOG.find(item => item.id === id);
  const unlocked = save => Array.isArray(save.achievements?.unlockedAchievements) ? save.achievements.unlockedAchievements : [];
  function isUnlocked(save, id) { return unlocked(save).some(item => (item.id || item) === id); }
  function progressFor(item, save) {
    const stats = save.statistics || {}, records = save.records || {}, spec = item.progress || {}, launches = stats.launchesByGame || {}, best = stats.bestResults || {}, target = Number(spec.target || 1); let current = 0;
    if (spec.metric === 'games') current = Number(stats.totalGames || 0);
    if (spec.metric === 'records') current = Number(stats.recordsCount || 0);
    if (spec.metric === 'coins') current = Number(stats.totalCoinsEarned || 0);
    if (spec.metric === 'goals') current = Number(stats.totalGoals || 0);
    if (spec.metric === 'perfectActions') current = Number(stats.perfectActions || 0);
    if (spec.metric === 'gameRecord') current = Number(records[spec.gameId]?.bestScore || best[spec.gameId] || 0) > 0 ? 1 : 0;
    if (spec.metric === 'gameScore') current = Math.max(Number(records[spec.gameId]?.bestScore || 0), Number(best[spec.gameId] || 0));
    if (spec.metric === 'availableGames') current = Object.keys(launches).filter(id => Number(launches[id] || 0) > 0 && window.TelePlayCatalog?.games?.some(game => game.id === id && game.status === 'available')).length;
    return { current: Math.min(current, target), raw: current, target, complete: current >= target };
  }
  function canUnlock(id, save) { const item = catalog(id); return Boolean(item && progressFor(item, save).complete); }
  window.TelePlayPlayer ??= {};
  window.TelePlayPlayer.Achievements = { CATALOG, catalog, unlocked, isUnlocked, progressFor, canUnlock };
})();
