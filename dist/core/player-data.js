(() => {
  const PLAYER_VERSION = 2;
  const shell = () => window.TelePlayGameShell;
  const core = () => window.TelePlayCore;
  const player = () => window.TelePlayPlayer;
  const today = () => new Date().toISOString().slice(0, 10);
  const inventoryDefaults = () => ({ profile: { ownedItems: ['avatar-frame-neon'], equippedItems: { avatarFrame: 'avatar-frame-neon' }, purchaseHistory: [] }, games: {} });
  const normalizeInventory = input => {
    const source = input || {}, base = inventoryDefaults(), profile = source.profile || {};
    const normalizedProfile = { ...base.profile, ...profile, ownedItems: Array.from(new Set(['avatar-frame-neon', ...(Array.isArray(profile.ownedItems) ? profile.ownedItems : [])])), equippedItems: { ...base.profile.equippedItems, ...(profile.equippedItems || {}) }, purchaseHistory: Array.isArray(profile.purchaseHistory) ? profile.purchaseHistory : [] };
    const games = Object.fromEntries(Object.entries(source.games || {}).map(([gameId, value]) => [gameId, { ownedItems: Array.from(new Set(Array.isArray(value?.ownedItems) ? value.ownedItems : [])), equippedItems: { ...(value?.equippedItems || {}) }, purchaseHistory: Array.isArray(value?.purchaseHistory) ? value.purchaseHistory : [] }]));
    return { profile: normalizedProfile, games };
  };
  function normalized(input = {}) {
    const save = { ...input }, profile = player().Profile.fromTelegram(save.profile || {}), totalXP = Math.max(Number(save.progress?.totalXP || 0), Number(save.progress?.xp || 0)), xp = player().Progress.snapshot(totalXP);
    save.profile = profile;
    save.statistics = player().Statistics.normalized(save.statistics || {});
    save.progress = { ...(save.progress || {}), level: xp.level, xp: xp.currentXP, totalXP: xp.totalXP, nextXP: xp.nextXP, rankId: xp.rank.id };
    save.mastery = player().Mastery.normalized(save.mastery || {});
    save.titles = player().Titles.normalized(save.titles || {});
    save.achievements = { unlockedAchievements: Array.isArray(save.achievements) ? save.achievements : (save.achievements?.unlockedAchievements || []) };
    save.settings = { soundEnabled: true, musicEnabled: true, hapticEnabled: true, language: 'ru', performanceMode: 'auto', ...(save.settings || {}) };
    save.activity = { lastPlayedGameId: null, lastPlayedDate: null, lastProgress: 0, daily: { lastActiveDate: null }, ...(save.activity || {}), daily: { lastActiveDate: null, ...(save.activity?.daily || {}) } };
    save.inventory = normalizeInventory(save.inventory);
    const hasPersistedBalance = Object.prototype.hasOwnProperty.call(save, 'coins'), hasPersistedGems = Object.prototype.hasOwnProperty.call(save, 'gems') || Object.prototype.hasOwnProperty.call(save, 'teleGems');
    const balance = hasPersistedBalance ? Math.max(0, Number(save.coins || 0)) : 0, gems = hasPersistedGems ? Math.max(0, Number(save.gems ?? save.teleGems ?? 0)) : 0;
    save.coins = balance; save.gems = gems; delete save.teleGems; delete save.economy; save.currencyTransactions = Array.isArray(save.currencyTransactions) ? save.currencyTransactions : []; save.adminActionLog = Array.isArray(save.adminActionLog) ? save.adminActionLog : []; save.analyticsEvents = Array.isArray(save.analyticsEvents) ? save.analyticsEvents : []; save.playerVersion = PLAYER_VERSION;
    return save;
  }
  function needsWrite(save = {}) { return !save.profile?.id || !save.profile?.createdAt || Number(save.playerVersion || 0) < PLAYER_VERSION || Object.prototype.hasOwnProperty.call(save, 'economy') || Object.prototype.hasOwnProperty.call(save, 'teleGems') || !Number.isFinite(Number(save.gems)) || !Array.isArray(save.currencyTransactions) || !Array.isArray(save.adminActionLog) || !Array.isArray(save.analyticsEvents) || !save.statistics?.launchesByGame || !save.settings || !save.activity?.daily || !save.inventory?.profile || !Array.isArray(save.inventory?.profile?.ownedItems) || !save.inventory?.games || !player().Mastery.genreKeys().every(genre => save.mastery?.[genre]) || !Array.isArray(save.titles?.unlockedTitleIds) || !save.titles?.activeTitleId; }
  function save(next) { const snapshot = normalized(next); return core().DataProvider?.savePlayer?.(snapshot) || core().SaveManager.write(snapshot); }
  function emit(event, gameId, params = {}) { core()?.Analytics?.track?.(event, gameId, params); }
  const PlayerData = {
    initialize() { const current = core().DataProvider?.getCurrentPlayerSync?.() || core().SaveManager.read(), next = normalized(current), created = !current.profile?.id, result = (created || needsWrite(current)) ? save(next) : next; if (created) emit('player_created', null, { playerId: result.profile.id }); return result; },
    get() { const current = core().DataProvider?.getCurrentPlayerSync?.() || core().SaveManager.read(), next = normalized(current); return needsWrite(current) ? save(next) : next; },
    async sync() {
      const remote = await core().DataProvider?.syncCurrentPlayer?.();
      if (!remote) return this.get();
      const next = normalized(remote);
      return save(next);
    },
    set(patch = {}) {
      const current = this.get(), next = { ...current, ...patch };
      ['profile', 'progress', 'statistics', 'settings', 'activity', 'achievements', 'mastery', 'titles', 'progression', 'inventory'].forEach(key => { if (patch[key]) next[key] = { ...(current[key] || {}), ...patch[key] }; });
      if (patch.activity?.daily) next.activity.daily = { ...(current.activity?.daily || {}), ...patch.activity.daily };
      if (Array.isArray(patch.currencyTransactions)) next.currencyTransactions = patch.currencyTransactions;
      return save(next);
    },
    profile(namespace) { const profile = this.get().profile; return namespace ? (profile[namespace] || {}) : profile; },
    updateProfile(namespace, patch) { if (typeof namespace === 'object') return this.set({ profile: { ...this.get().profile, ...namespace } }); return this.set({ profile: { ...this.get().profile, [namespace]: { ...(this.get().profile[namespace] || {}), ...patch } } }); },
    coins() { return Number(this.get().coins || 0); },
    gems() { return Number(this.get().gems || 0); },
    addCoins(amount, source = 'game', metadata = {}) { const result = core().CurrencyManager?.addCoins?.(amount, source, metadata); return result ? result.balance : this.coins(); },
    spendCoins(amount, source = 'shop', metadata = {}) { return core().CurrencyManager?.spendCoins?.(amount, source, metadata) || { ok: false, spent: 0, balance: this.coins(), reason: 'currency_manager_unavailable' }; },
    addGems(amount, source = 'reward', metadata = {}) { const result = core().CurrencyManager?.addGems?.(amount, source, metadata); return result ? result.balance : this.gems(); },
    spendGems(amount, source = 'shop', metadata = {}) { return core().CurrencyManager?.spendGems?.(amount, source, metadata) || { ok: false, spent: 0, balance: this.gems(), reason: 'currency_manager_unavailable' }; },
    game(gameId) { const saveState = this.get(); return saveState.records?.[gameId] || shell()?.getStats?.(gameId) || { bestScore: 0, gamesPlayed: 0, lastScore: 0 }; },
    record(gameId, patch) { const current = this.get(); return this.set({ records: { ...(current.records || {}), [gameId]: { ...this.game(gameId), ...patch } } }); },
    progress() { return player().Progress.snapshot(this.get().progress.totalXP); },
    rank() { return this.progress().rank; },
    mastery() { const value = this.get().mastery || {}; return Object.fromEntries(player().Mastery.genreKeys().map(genre => [genre, player().Mastery.snapshot(value[genre]?.totalXP || 0)])); },
    activeTitle() { const titles = this.get().titles; return player().Titles.catalog(titles.activeTitleId); },
    achievementProgress() { const state = this.get(), catalog = player().Achievements.CATALOG, completed = player().Achievements.unlocked(state).length; return { completed, total: catalog.length, items: catalog.map(item => ({ ...item, progress: player().Achievements.progressFor(item, state), unlocked: player().Achievements.isUnlocked(state, item.id) })) }; },
    addXP(amount, source = 'system', params = {}) {
      if (core().DataProvider?.isBackendEnabled?.() && !core().RewardManager?.isApplyingProof?.()) return this.progress();
      const gain = Math.max(0, Math.floor(Number(amount) || 0)); if (!gain) return this.progress();
      const before = this.progress(), current = this.get(), after = player().Progress.snapshot(before.totalXP + gain);
      this.set({ progress: { ...current.progress, level: after.level, xp: after.currentXP, totalXP: after.totalXP, nextXP: after.nextXP, rankId: after.rank.id } });
      emit('xp_received', params.gameId || null, { amount: gain, source, totalXP: after.totalXP, level: after.level });
      if (after.level > before.level) emit('level_up', params.gameId || null, { from: before.level, level: after.level, totalXP: after.totalXP });
      if (after.rank.id !== before.rank.id) emit('rank_changed', params.gameId || null, { from: before.rank.id, rank: after.rank.id, level: after.level });
      return after;
    },
    addMastery(gameId, amount, source = 'gameplay') {
      const gain = Math.max(0, Math.floor(Number(amount) || 0)); if (!gain) return null;
      const genre = player().Mastery.genreFor(gameId), current = this.get(), before = player().Mastery.snapshot(current.mastery?.[genre]?.totalXP || 0), after = player().Mastery.snapshot(before.totalXP + gain), mastery = player().Mastery.normalized(current.mastery);
      mastery[genre] = { totalXP: after.totalXP, level: after.level }; this.set({ mastery });
      if (after.level > before.level) emit('mastery_up', gameId, { genre, from: before.level, level: after.level, amount: gain, source });
      return { genre, before, after };
    },
    unlockTitle(id, gameId = null, equip = true) {
      const current = this.get(), item = player().Titles.catalog(id); if (!item || current.titles.unlockedTitleIds.includes(item.id)) return false;
      const unlockedTitleIds = [...current.titles.unlockedTitleIds, item.id], titles = { ...current.titles, unlockedTitleIds, activeTitleId: equip ? item.id : current.titles.activeTitleId };
      this.set({ titles }); emit('title_unlocked', gameId, { titleId: item.id, title: item.title, rarity: item.rarity }); return true;
    },
    setActiveTitle(id) { const current = this.get(); if (!current.titles.unlockedTitleIds.includes(id)) return false; this.set({ titles: { ...current.titles, activeTitleId: id } }); return true; },
    startGame(gameId, params = {}) {
      const current = this.get(), launches = Number(current.statistics.launchesByGame?.[gameId] || 0), statistics = player().Statistics.started(current.statistics, gameId), streak = current.progression?.challenges?.streak || {}, daily = player().XPManager.dailyBonus(current.activity, today(), streak), activity = { ...current.activity, lastPlayedGameId: gameId, lastPlayedDate: today(), lastProgress: Number(params.progress || 0), daily: daily.next }, favoriteGameId = player().Statistics.favorite(statistics), values = player().ProgressionConfig;
      this.set({ statistics, activity, favoriteGameId });
      if (!launches) this.addXP(values.XP.firstGameLaunch, 'first_game_launch', { gameId });
      if (daily.isFirstToday) this.addXP(daily.xp, 'daily_first_launch', { gameId, streak: daily.streak });
      this.addMastery(gameId, values.MASTERY.gameStarted, 'game_started'); this.checkAchievements('game_started', gameId, params); return this.get();
    },
    finishGame(gameId, result = {}) {
      const current = this.get(), statistics = player().Statistics.finished(current.statistics, gameId, result), activity = { ...current.activity, lastPlayedGameId: gameId, lastPlayedDate: today(), lastProgress: Number(result.progress || result.level || 0) }, values = player().ProgressionConfig;
      this.set({ statistics, activity }); player().XPManager.finishRewards(gameId, result).forEach(reward => this.addXP(reward.amount, reward.source, { gameId })); this.addMastery(gameId, values.MASTERY.gameFinished, 'game_finished'); this.checkAchievements('game_finished', gameId, result); return this.get();
    },
    markRecord(gameId, score) {
      const current = this.get(), statistics = { ...current.statistics, recordsCount: Number(current.statistics.recordsCount || 0) + 1, bestResults: { ...current.statistics.bestResults, [gameId]: Math.max(Number(current.statistics.bestResults?.[gameId] || 0), Number(score || 0)) } }, values = player().ProgressionConfig;
      this.set({ statistics }); this.addXP(values.XP.newRecord, 'new_record', { gameId, score }); this.addMastery(gameId, values.MASTERY.newRecord, 'new_record'); this.checkAchievements('new_record', gameId, { score });
    },
    recordPerfect(gameId, params = {}) {
      const current = this.get(), statistics = { ...current.statistics, perfectActions: Number(current.statistics.perfectActions || 0) + 1 }, values = player().ProgressionConfig;
      this.set({ statistics }); this.addXP(values.XP.perfectAction, 'perfect_action', { gameId, ...params }); this.addMastery(gameId, values.MASTERY.skillAction, 'perfect_action'); this.checkAchievements('perfect_action', gameId, params);
    },
    recordGoal(gameId, params = {}) {
      if (params.training) return; const current = this.get(), statistics = { ...current.statistics, totalGoals: Number(current.statistics.totalGoals || 0) + 1 };
      this.set({ statistics }); this.checkAchievements('goal', gameId, params);
    },
    lastPlayed() { return this.get().activity; },
    favoriteGame() { return this.get().favoriteGameId || player().Statistics.favorite(this.get().statistics); },
    settings() { return this.get().settings; },
    updateSettings(patch) { const result = this.set({ settings: { ...this.get().settings, ...patch } }); emit('profile_updated', null, { fields: Object.keys(patch || {}) }); return result.settings; },
    achievements() { return this.get().achievements; },
    unlockAchievement(id, gameId) {
      if (core().DataProvider?.isBackendEnabled?.() && !core().RewardManager?.isApplyingProof?.()) return false;
      const current = this.get(); if (player().Achievements.isUnlocked(current, id)) return false; const item = player().Achievements.catalog(id); if (!item) return false;
      const unlocked = [...player().Achievements.unlocked(current), { id, unlockedAt: Date.now() }]; this.set({ achievements: { unlockedAchievements: unlocked } }); const rewardManager = core().RewardManager; if (rewardManager?.award) rewardManager.award(gameId || 'achievement', { coins: item.rewardCoins || 0, xp: item.rewardXP || player().ProgressionConfig.XP.achievement, xpSource: 'achievement', metadata: { transactionId: `achievement:${id}`, achievementId: id } }); else this.addXP(item.rewardXP || player().ProgressionConfig.XP.achievement, 'achievement', { gameId, achievementId: id }); if (item.rewardTitle) this.unlockTitle(item.rewardTitle, gameId, true); emit('achievement_unlocked', gameId || null, { achievementId: id, rewardXP: item.rewardXP, rewardCoins: item.rewardCoins, rarity: item.rarity }); return true;
    },
    checkAchievements(event, gameId, params = {}) { const saveState = this.get(); player().Achievements.CATALOG.forEach(item => { if (player().Achievements.canUnlock(item.id, saveState)) this.unlockAchievement(item.id, gameId, { ...params, event }); }); },
    handleEvent(event, gameId, params = {}) {
      if (event === 'game_started') this.startGame(gameId, params);
      else if (event === 'game_finished') this.finishGame(gameId, params);
      else if (event === 'new_record') this.markRecord(gameId, params.score);
      else if (event === 'level_completed') { this.addXP(player().ProgressionConfig.XP.victory, 'level_completed', { gameId }); this.checkAchievements(event, gameId, params); }
      else if (event === 'penalty_duel_goal') this.recordGoal(gameId, params);
      else if (['beat_dash_perfect_jump', 'neon_hook_perfect_release', 'penalty_duel_perfect'].includes(event) || (event === 'neon_race_near_miss' && params.perfect)) this.recordPerfect(gameId, params);
      else if (event !== 'game_finished' && /_finished$/.test(event) && gameId && params.progress != null) this.set({ activity: { ...this.get().activity, lastPlayedGameId: gameId, lastPlayedDate: today(), lastProgress: Number(params.progress || 0) } });
    }
  };
  window.TelePlayCore ??= {}; window.TelePlayCore.PlayerData = PlayerData;
})();
