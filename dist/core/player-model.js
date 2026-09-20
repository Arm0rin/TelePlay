(() => {
  const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;
  const array = value => Array.isArray(value) ? value : [];
  const object = value => value && typeof value === 'object' ? value : {};
  const clone = value => JSON.parse(JSON.stringify(value ?? {}));
  const schema = Object.freeze({
    Players: ['telegramId', 'username', 'firstName', 'avatar', 'createdAt', 'lastActive', 'account', 'migration', 'progress', 'economy', 'inventory', 'statistics'],
    Transactions: ['id', 'playerId', 'currency', 'type', 'amount', 'source', 'metadata', 'createdAt'],
    GameSessions: ['id', 'playerId', 'gameId', 'startedAt', 'finishedAt', 'score', 'result'],
    AnalyticsEvents: ['id', 'playerId', 'event', 'timestamp', 'metadata'],
    Inventory: ['playerId', 'scope', 'itemId', 'slot', 'equipped', 'updatedAt'],
    AdminActions: ['id', 'adminId', 'role', 'action', 'targetPlayer', 'amount', 'reason', 'timestamp']
  });
  const toRecord = save => {
    const state = object(save), profile = object(state.profile), progress = object(state.progress), progression = object(state.progression), challenges = object(progression.challenges), streak = object(challenges.streak), inventory = object(state.inventory), stats = object(state.statistics);
    return {
      telegramId: String(profile.id || 'guest'),
      username: String(profile.username || 'Игрок'),
      firstName: String(profile.firstName || ''),
      avatar: String(profile.avatar || ''),
      createdAt: number(profile.createdAt),
      lastActive: state.activity?.lastPlayedDate || null,
      account: clone(state.account || { provider: 'telegram', source: 'telegram_registration' }),
      migration: clone(state.migration || { completed: false, required: false, status: 'not_required' }),
      progress: { level: number(progress.level) || 1, xp: number(progress.xp), totalXP: number(progress.totalXP), rank: progress.rankId || null, achievements: array(state.achievements?.unlockedAchievements).map(item => item?.id || item), streak: { currentStreak: number(streak.currentStreak), bestStreak: number(streak.bestStreak), lastActiveDate: streak.lastActiveDate || null } },
      economy: { coins: number(state.coins), gems: number(state.gems) },
      inventory: { profile: clone(inventory.profile || {}), games: clone(inventory.games || {}), profileItems: array(inventory.profile?.ownedItems), gameItems: clone(inventory.games || {}) },
      statistics: { ...clone(stats), sessions: number(stats.totalGames || stats.gamesPlayed), favoriteGame: state.favoriteGameId || null },
      records: clone(state.records || {}),
      mastery: clone(state.mastery || {}),
      titles: clone(state.titles || {}),
      challenges: clone(progression.challenges || {}),
      state: { settings: clone(state.settings || {}), activity: clone(state.activity || {}), favoriteGameId: state.favoriteGameId || null }
    };
  };
  const fromRecord = (record, current = {}) => {
    const remote = object(record), base = clone(current), profile = object(remote.profile), progress = object(remote.progress), economy = object(remote.economy), inventory = object(remote.inventory), statistics = object(remote.statistics);
    const telegramId = remote.telegramId || remote.playerId || profile.id;
    if (telegramId) base.profile = { ...object(base.profile), id: String(telegramId), username: String(remote.username || profile.username || base.profile?.username || 'Игрок'), firstName: String(remote.firstName || profile.firstName || base.profile?.firstName || ''), avatar: String(remote.avatar || profile.avatar || base.profile?.avatar || ''), createdAt: number(remote.createdAt || profile.createdAt || base.profile?.createdAt || Date.now()) };
    if (remote.account) base.account = clone(remote.account);
    if (remote.migration) base.migration = clone(remote.migration);
    if (remote.coins != null || remote.gems != null || Object.keys(economy).length) { base.coins = number(remote.coins ?? economy.coins ?? base.coins); base.gems = number(remote.gems ?? economy.gems ?? base.gems); }
    if (Object.keys(progress).length) base.progress = { ...object(base.progress), ...progress, totalXP: number(progress.totalXP ?? progress.xp ?? base.progress?.totalXP) };
    if (Array.isArray(remote.achievements) || Array.isArray(progress.achievements)) base.achievements = { ...object(base.achievements), unlockedAchievements: array(remote.achievements || progress.achievements) };
    if (inventory.profile || inventory.games || inventory.profileItems || inventory.gameItems) base.inventory = { ...object(base.inventory), profile: { ...object(base.inventory?.profile), ...object(inventory.profile), ownedItems: array(inventory.profile?.ownedItems || inventory.profileItems) }, games: inventory.games || inventory.gameItems || base.inventory?.games || {} };
    if (Object.keys(statistics).length) base.statistics = { ...object(base.statistics), ...statistics, totalGames: number(statistics.totalGames ?? statistics.sessions ?? base.statistics?.totalGames) };
    if (remote.records) base.records = clone(remote.records);
    if (remote.mastery) base.mastery = clone(remote.mastery);
    if (remote.titles) base.titles = clone(remote.titles);
    if (remote.challenges || progress.streak) base.progression = { ...object(base.progression), challenges: { ...object(base.progression?.challenges), ...object(remote.challenges), ...(progress.streak ? { streak: clone(progress.streak) } : {}) } };
    if (remote.state?.settings) base.settings = { ...object(base.settings), ...remote.state.settings };
    if (remote.state?.activity || remote.lastActive) base.activity = { ...object(base.activity), ...object(remote.state?.activity), ...(remote.lastActive ? { lastPlayedDate: remote.lastActive } : {}) };
    if (remote.state?.favoriteGameId || statistics.favoriteGame) base.favoriteGameId = remote.state?.favoriteGameId || statistics.favoriteGame;
    return base;
  };
  window.TelePlayDataModel = { schema, toRecord, fromRecord };
  window.TelePlayCore ??= {};
  window.TelePlayCore.PlayerModel = window.TelePlayDataModel;
})();
