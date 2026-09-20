(() => {
  const available = games => (games || []).filter(game => game?.status === 'available');
  const dayKey = value => value || new Date().toISOString().slice(0, 10);
  const gameOfDay = (games, date) => {
    const list = available(games);
    if (!list.length) return null;
    const seed = [...dayKey(date)].reduce((sum, char) => sum + char.charCodeAt(0), 0);
    return list[seed % list.length];
  };
  const continueGame = (save, games) => {
    const id = save?.activity?.lastPlayedGameId;
    const game = (games || []).find(item => item.id === id && item.status === 'available');
    if (!game) return null;
    return {
      game,
      progress: Math.max(0, Math.min(100, Number(save.activity.lastProgress || 0))),
      isLastPlayed: true,
    };
  };
  const lastAchievement = save => {
    const list = save?.achievements?.unlockedAchievements || [];
    const last = list[list.length - 1];
    const id = typeof last === 'string' ? last : last?.id;
    return id ? window.TelePlayPlayer?.Achievements?.catalog?.(id) || { id, title: id, rewardXP: 0 } : null;
  };
  const randomGame = (games, excludeId) => {
    const list = available(games).filter(game => game.id !== excludeId);
    const source = list.length ? list : available(games);
    return source[Math.floor(Math.random() * source.length)] || null;
  };
  window.TelePlayPlayer = window.TelePlayPlayer || {};
  window.TelePlayPlayer.Home = {
    available,
    gameOfDay,
    continueGame,
    lastAchievement,
    randomGame,
    futureSlots: ['dailyChallenge', 'events', 'friendsChallenges', 'leaderboard'],
  };
})();
