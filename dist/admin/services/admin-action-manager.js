(() => {
  const admin = () => window.TelePlayAdmin || {};
  const core = () => window.TelePlayCore || {};
  const integer = value => Math.max(0, Math.floor(Number(value) || 0));
  const currentPlayer = () => core().PlayerData?.get?.() || {};
  const targetCheck = targetPlayerId => {
    const currentId = String(currentPlayer().profile?.id || '');
    if (!targetPlayerId || String(targetPlayerId) === currentId) return { ok: true, targetPlayerId: currentId };
    if (core().DataProvider?.isBackendActive?.()) return { ok: true, targetPlayerId: String(targetPlayerId), remote: true };
    if (core().DataProvider?.isBackendEnabled?.()) return { ok: false, reason: 'backend_unavailable', targetPlayerId: String(targetPlayerId) };
    return { ok: false, reason: 'player_not_available', targetPlayerId: String(targetPlayerId) };
  };
  const guard = (permission = 'manage_players') => admin().Auth?.guard?.(permission) || { ok: false, reason: 'access_denied' };
  const log = (action, targetPlayer, details = {}) => {
    const session = admin().Auth.current();
    admin().Log?.recordAction?.({ adminId: session.telegramId || session.username, role: session.role || null, action, targetPlayer: targetPlayer || null, ...details, timestamp: Date.now() });
  };
  const baseFailure = (check, target) => ({ ok: false, reason: check.reason || 'access_denied', targetPlayer: target || null });
  const remoteAction = (action, targetPlayerId, details = {}) => {
    const session = admin().Auth.current(), entry = { id: `admin:${session.telegramId || session.username}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`, action, adminId: session.telegramId || session.username, role: session.role, targetPlayer: String(targetPlayerId), ...details, timestamp: Date.now() };
    if (!core().DataProvider?.isBackendActive?.()) return Promise.resolve({ ok: false, reason: 'backend_unavailable', targetPlayerId: String(targetPlayerId), action });
    return core().DataProvider.postAdminAction(entry)
      .then(result => ({ ok: true, targetPlayerId: String(targetPlayerId), action, result }))
      .catch(error => ({ ok: false, reason: error?.code || 'backend_unavailable', targetPlayerId: String(targetPlayerId), action }));
  };
  const action = {
    paymentCompensation({ targetPlayerId, paymentId, amount, reason = '' } = {}) {
      const permission = guard('manage_economy'), target = targetCheck(targetPlayerId), value = integer(amount);
      if (!permission.ok) return baseFailure(permission);
      if (!target.ok) return baseFailure(target, targetPlayerId);
      if (!paymentId || !value) return { ok: false, reason: 'payment_compensation_invalid' };
      return remoteAction('payment_compensation', target.targetPlayerId, { paymentId: String(paymentId), amount: value, reason, operation: 'payment_compensation' });
    },
    adjustCurrency({ targetPlayerId, currencyType = 'coins', amount = 0, reason = '' } = {}) {
      const permission = guard('manage_economy'), target = targetCheck(targetPlayerId), currency = String(currencyType).toLowerCase() === 'gems' ? 'gems' : 'coins', value = Math.floor(Number(amount) || 0);
      if (!permission.ok) return baseFailure(permission);
      if (!target.ok) return baseFailure(target, targetPlayerId);
      if (!value) return { ok: false, reason: 'invalid_amount' };
      if (target.remote || core().DataProvider?.isBackendActive?.()) return remoteAction(value > 0 ? 'currency_granted' : 'currency_spent', target.targetPlayerId, { amount: value, currencyType: currency, reason, operation: 'currency', metadata: { source: 'admin_panel' } });
      const session = admin().Auth.current(), transactionId = `admin:${session.telegramId || session.username}:${Date.now()}:${Math.random().toString(36).slice(2, 7)}`, metadata = { transactionId, adminId: session.telegramId || session.username, role: session.role, targetPlayerId: target.targetPlayerId, reason };
      const result = value > 0
        ? core().RewardManager?.award?.('admin', { [currency]: value, metadata })
        : core().CurrencyManager?.[currency === 'gems' ? 'spendGems' : 'spendCoins']?.(Math.abs(value), 'admin', metadata);
      if (!result?.ok) return { ok: false, reason: result?.reason || 'currency_operation_failed', result };
      log(value > 0 ? 'currency_granted' : 'currency_spent', target.targetPlayerId, { amount: value, currencyType: currency, reason, transactionId });
      return { ok: true, currencyType: currency, amount: value, balance: result.balance, transaction: result.transaction || null };
    },
    setXP({ targetPlayerId, totalXP = 0, reason = '' } = {}) {
      const permission = guard('manage_players'), target = targetCheck(targetPlayerId);
      if (!permission.ok) return baseFailure(permission);
      if (!target.ok) return baseFailure(target, targetPlayerId);
      const current = currentPlayer(), nextXP = integer(totalXP), before = Number(current.progress?.totalXP || 0);
      if (target.remote || core().DataProvider?.isBackendActive?.()) return remoteAction('xp_changed', target.targetPlayerId, { amount: nextXP, totalXP: nextXP, reason, operation: 'set_xp' });
      const snapshot = core().PlayerData?.set?.({ progress: { ...(current.progress || {}), totalXP: nextXP, xp: nextXP } });
      if (!snapshot) return { ok: false, reason: 'player_data_unavailable' };
      log('xp_changed', target.targetPlayerId, { amount: nextXP - before, totalXP: nextXP, reason });
      return { ok: true, totalXP: nextXP, progress: core().PlayerData.progress?.() || null };
    },
    setLevel({ targetPlayerId, level = 1, reason = '' } = {}) {
      const nextLevel = Math.min(100, Math.max(1, integer(level))), progress = window.TelePlayPlayer?.Progress, config = window.TelePlayPlayer?.ProgressionConfig?.XP;
      if (!progress || !config) return { ok: false, reason: 'progression_unavailable' };
      let totalXP = 0; for (let current = 1; current < nextLevel; current += 1) totalXP += progress.xpRequiredForLevel(current);
      return this.setXP({ targetPlayerId, totalXP, reason: reason || `set_level_${nextLevel}` });
    },
    setStreak({ targetPlayerId, currentStreak = 0, bestStreak, reason = '' } = {}) {
      const permission = guard('manage_players'), target = targetCheck(targetPlayerId);
      if (!permission.ok) return baseFailure(permission);
      if (!target.ok) return baseFailure(target, targetPlayerId);
      if (target.remote || core().DataProvider?.isBackendActive?.()) return remoteAction('streak_changed', target.targetPlayerId, { currentStreak: integer(currentStreak), bestStreak: integer(bestStreak), reason, operation: 'set_streak' });
      const state = currentPlayer(), previous = state.progression?.challenges?.streak || {}, current = integer(currentStreak), best = Math.max(current, integer(bestStreak == null ? previous.bestStreak : bestStreak));
      core().PlayerData?.set?.({ progression: { ...(state.progression || {}), challenges: { ...(state.progression?.challenges || {}), streak: { ...previous, currentStreak: current, bestStreak: best } } } });
      log('streak_changed', target.targetPlayerId, { amount: current - integer(previous.currentStreak), currentStreak: current, bestStreak: best, reason });
      return { ok: true, currentStreak: current, bestStreak: best };
    },
    grantAchievement({ targetPlayerId, achievementId, reason = '' } = {}) {
      const permission = guard('manage_players'), target = targetCheck(targetPlayerId);
      if (!permission.ok) return baseFailure(permission);
      if (!target.ok) return baseFailure(target, targetPlayerId);
      if (!achievementId || !window.TelePlayPlayer?.Achievements?.catalog?.(achievementId)) return { ok: false, reason: 'unknown_achievement' };
      if (target.remote || core().DataProvider?.isBackendActive?.()) return remoteAction('achievement_granted', target.targetPlayerId, { achievementId, reason, operation: 'grant_achievement' });
      const changed = core().PlayerData.unlockAchievement?.(achievementId, 'admin');
      if (!changed) return { ok: false, reason: 'already_unlocked' };
      log('achievement_granted', target.targetPlayerId, { achievementId, reason });
      return { ok: true, achievementId };
    },
    revokeAchievement({ targetPlayerId, achievementId, reason = '' } = {}) {
      const permission = guard('manage_players'), target = targetCheck(targetPlayerId);
      if (!permission.ok) return baseFailure(permission);
      if (!target.ok) return baseFailure(target, targetPlayerId);
      if (target.remote || core().DataProvider?.isBackendActive?.()) return remoteAction('achievement_revoked', target.targetPlayerId, { achievementId, reason, operation: 'revoke_achievement' });
      const state = currentPlayer(), unlocked = Array.isArray(state.achievements?.unlockedAchievements) ? state.achievements.unlockedAchievements : [], next = unlocked.filter(item => (item.id || item) !== achievementId);
      if (next.length === unlocked.length) return { ok: false, reason: 'not_unlocked' };
      core().PlayerData.set({ achievements: { unlockedAchievements: next } }); log('achievement_revoked', target.targetPlayerId, { achievementId, reason }); return { ok: true, achievementId };
    },
    grantItem({ targetPlayerId, itemId, gameId = null, reason = '' } = {}) {
      const permission = guard('manage_players'), target = targetCheck(targetPlayerId);
      if (!permission.ok) return baseFailure(permission);
      if (!target.ok) return baseFailure(target, targetPlayerId);
      const manager = core().ShopManager, catalog = gameId ? manager?.gameCatalog?.(gameId) : null, item = gameId ? catalog?.items?.find(value => value.id === itemId) : window.TelePlayShopConfig?.ITEMS?.find(value => value.id === itemId);
      if (!item) return { ok: false, reason: 'unknown_item' };
      if (target.remote || core().DataProvider?.isBackendActive?.()) return remoteAction('item_granted', target.targetPlayerId, { itemId, gameId, reason, operation: 'grant_item' });
      const state = currentPlayer(), inventory = state.inventory || {}, scope = gameId ? { ...(inventory.games?.[gameId] || {}), ownedItems: Array.from(new Set([...(inventory.games?.[gameId]?.ownedItems || []), itemId])), equippedItems: { ...(inventory.games?.[gameId]?.equippedItems || {}) }, purchaseHistory: inventory.games?.[gameId]?.purchaseHistory || [] } : { ...(inventory.profile || {}), ownedItems: Array.from(new Set([...(inventory.profile?.ownedItems || []), itemId])), equippedItems: { ...(inventory.profile?.equippedItems || {}) }, purchaseHistory: inventory.profile?.purchaseHistory || [] };
      const nextInventory = gameId ? { ...inventory, games: { ...(inventory.games || {}), [gameId]: scope } } : { ...inventory, profile: scope };
      core().PlayerData.set({ inventory: nextInventory }); log('item_granted', target.targetPlayerId, { itemId, gameId, reason }); return { ok: true, itemId, gameId };
    },
    revokeItem({ targetPlayerId, itemId, gameId = null, reason = '' } = {}) {
      const permission = guard('manage_players'), target = targetCheck(targetPlayerId);
      if (!permission.ok) return baseFailure(permission);
      if (!target.ok) return baseFailure(target, targetPlayerId);
      if (target.remote || core().DataProvider?.isBackendActive?.()) return remoteAction('item_revoked', target.targetPlayerId, { itemId, gameId, reason, operation: 'revoke_item' });
      const state = currentPlayer(), inventory = state.inventory || {}, source = gameId ? inventory.games?.[gameId] : inventory.profile, owned = Array.isArray(source?.ownedItems) ? source.ownedItems : [];
      if (!owned.includes(itemId)) return { ok: false, reason: 'not_owned' };
      const scope = { ...source, ownedItems: owned.filter(id => id !== itemId), equippedItems: Object.fromEntries(Object.entries(source.equippedItems || {}).filter(([, id]) => id !== itemId)) };
      const nextInventory = gameId ? { ...inventory, games: { ...(inventory.games || {}), [gameId]: scope } } : { ...inventory, profile: scope };
      core().PlayerData.set({ inventory: nextInventory }); log('item_revoked', target.targetPlayerId, { itemId, gameId, reason }); return { ok: true, itemId, gameId };
    }
  };
  window.TelePlayAdmin = window.TelePlayAdmin || {};
  window.TelePlayAdmin.Actions = action;
  window.TelePlayCore = window.TelePlayCore || {};
  window.TelePlayCore.AdminActionManager = action;
})();
