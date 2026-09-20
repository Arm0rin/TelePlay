(() => {
  const core = () => window.TelePlayCore || {};
  const catalog = () => window.TelePlayCatalog?.games || [];
  const manager = () => core().ShopManager;
  const read = () => core().PlayerData?.get?.() || {};
  const today = () => new Date().toISOString().slice(0, 10);
  const dateTime = value => value ? new Date(value).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';
  const currency = value => Math.abs(Number(value) || 0);
  let globalPlayers = [];
  let globalTransactions = [], globalEvents = [], globalActions = [], globalRewardProofs = [], globalGameResults = [], globalFraudEvents = [], globalPayments = [];
  let globalLoad = { state: 'idle', scope: 'local', error: null, count: 0 };
  const backendMode = () => core().DataProvider?.configuredMode === 'backend';
  const model = () => window.TelePlayDataModel;
  const adminPlayer = (record, source = 'LIVE') => {
    const raw = record || {}, value = raw?.profile ? { ...model()?.toRecord?.(raw), account: raw.account, migration: raw.migration } : raw, progress = value.progress || {}, economy = value.economy || {}, inventory = value.inventory || {}, stats = value.statistics || {};
    return { id: String(value.telegramId || value.playerId || value.id || 'guest'), username: value.username || 'Игрок', firstName: value.firstName || '', avatar: value.avatar || '', level: Number(progress.level || 1), xp: Number(progress.totalXP ?? progress.xp ?? 0), rank: progress.rank || progress.rankId || 'Rookie', coins: Number(economy.coins ?? value.coins ?? 0), gems: Number(economy.gems ?? value.gems ?? 0), achievements: Array.isArray(progress.achievements) ? progress.achievements.length : Number(value.achievementsCount || 0), inventory: { profile: { ownedItems: inventory.profileItems || inventory.profile?.ownedItems || [] }, games: inventory.gameItems || inventory.games || {} }, lastActive: value.lastActive || value.activity?.lastPlayedDate || null, createdAt: value.createdAt || value.profile?.createdAt || null, statistics: stats, records: value.records || {}, transactions: value.transactions || [], account: value.account || { provider: 'telegram', source: 'telegram_registration' }, migration: value.migration || { completed: false, required: false, status: 'not_required' }, source };
  };
  const currentPlayer = () => {
    return adminPlayer(read(), 'LOCAL');
  };
  const transactions = () => backendMode() ? globalTransactions : (core().CurrencyManager?.getTransactions?.() || read().currencyTransactions || []);
  const economy = () => {
    const data = read(), result = { coins: { generated: 0, spent: 0, balance: Number(data.coins || 0) }, gems: { generated: 0, spent: 0, balance: Number(data.gems || 0) }, transactions: [] };
    result.transactions = transactions().slice().reverse().map(item => ({ ...item, amount: currency(item.amount), direction: item.type === 'spend' ? '-' : '+', date: dateTime(item.createdAt) }));
    result.transactions.forEach(item => { const type = item.currencyType === 'gems' ? 'gems' : 'coins'; if (item.type === 'spend') result[type].spent += currency(item.amount); else result[type].generated += currency(item.amount); });
    return result;
  };
  const dashboard = () => {
    const data = read(), stats = data.statistics || {}, sessions = Number(stats.totalGames || stats.gamesPlayed || 0), playTime = Number(stats.totalPlayTime || 0), active = data.activity?.lastPlayedDate === today() ? 1 : 0, isGlobal = backendMode(), rows = isGlobal ? globalPlayers : [currentPlayer()], activeRows = rows.filter(player => player.lastActive && new Date(player.lastActive).toISOString().slice(0, 10) === today());
    const totalSessions = rows.reduce((sum, player) => sum + Number(player.statistics?.totalGames || player.statistics?.sessions || 0), 0) || sessions;
    const totalPlayTime = rows.reduce((sum, player) => sum + Number(player.statistics?.totalPlayTime || 0), 0) || playTime;
    return { playersTotal: rows.length, activeToday: isGlobal ? activeRows.length : active, newPlayers: rows.filter(player => player.createdAt && new Date(player.createdAt).toISOString().slice(0, 10) === today()).length, gamesPlayedToday: isGlobal ? activeRows.reduce((sum, player) => sum + Number(player.statistics?.totalGames || player.statistics?.gamesPlayed || 0), 0) : (active ? 1 : 0), totalSessions, averageSessionTime: totalSessions ? Math.round(totalPlayTime / totalSessions) : 0, scope: isGlobal ? 'backend' : 'local-device' };
  };
  const playerRows = (query, filters = {}) => {
    const rows = backendMode() ? globalPlayers : [currentPlayer()], value = String(query || '').trim().toLowerCase().replace(/^@/, '');
    return rows.filter(player => {
      if (value && !player.id.toLowerCase().includes(value) && !player.username.toLowerCase().includes(value)) return false;
      const created = player.createdAt ? new Date(player.createdAt).toISOString().slice(0, 10) : '', active = player.lastActive ? new Date(player.lastActive).toISOString().slice(0, 10) : '';
      if (filters.filter === 'new' && created !== today()) return false;
      if (filters.filter === 'active' && active !== today()) return false;
      return true;
    }).sort((a, b) => filters.sort === 'level' ? b.level - a.level : filters.sort === 'played' ? Number(b.statistics?.totalGames || 0) - Number(a.statistics?.totalGames || 0) : String(a.username).localeCompare(String(b.username)));
  };
  const loadPlayers = async (query = '', filters = {}) => {
    const provider = core().DataProvider;
    if (provider?.listPlayers) {
      const records = await provider.listPlayers({ query, filters, filter: filters.filter, sort: filters.sort, strict: backendMode() });
      globalPlayers = records.map(record => adminPlayer(record, backendMode() ? 'BACKEND' : 'LOCAL'));
    }
    return playerRows(query, filters);
  };
  const loadGlobal = async (query = '', filters = {}) => {
    const provider = core().DataProvider;
    if (!provider) return playerRows(query, filters);
    const strict = backendMode();
    globalLoad = { state: 'loading', scope: strict ? 'backend' : 'local', error: null, count: globalPlayers.length };
    const results = await Promise.allSettled([
      provider.listPlayers({ query, filters, filter: filters.filter, sort: filters.sort, strict }),
      provider.getTransactions?.({ strict }),
      provider.getAnalyticsEvents?.({ strict }),
      provider.getAdminActions?.({ strict }),
      provider.getRewardProofs?.({ strict }),
      provider.getGameResults?.({ strict }),
      provider.getFraudEvents?.({ strict }),
      provider.getPayments?.({ strict })
    ]);
    const [playersResult, transactionsResult, eventsResult, actionsResult, proofsResult, resultsResult, fraudResult, paymentsResult] = results;
    if (playersResult.status === 'fulfilled') {
      globalPlayers = (playersResult.value || []).map(record => adminPlayer(record, strict ? 'BACKEND' : 'LOCAL'));
      globalLoad = { state: 'ready', scope: strict ? 'backend' : 'local', error: null, count: globalPlayers.length };
    } else if (strict) {
      globalPlayers = [];
      globalLoad = { state: 'error', scope: 'backend', error: playersResult.reason?.code || 'backend_unavailable', count: 0 };
    }
    if (transactionsResult.status === 'fulfilled') globalTransactions = transactionsResult.value || [];
    if (eventsResult.status === 'fulfilled') globalEvents = eventsResult.value || [];
    if (actionsResult.status === 'fulfilled') globalActions = actionsResult.value || [];
    if (proofsResult.status === 'fulfilled') globalRewardProofs = proofsResult.value || [];
    if (resultsResult.status === 'fulfilled') globalGameResults = resultsResult.value || [];
    if (fraudResult.status === 'fulfilled') globalFraudEvents = fraudResult.value || [];
    if (paymentsResult.status === 'fulfilled') globalPayments = paymentsResult.value || [];
    return playerRows(query, filters);
  };
  const selectedPlayer = playerId => playerRows('').find(player => String(player.id) === String(playerId)) || (backendMode() ? null : currentPlayer());
  const loadPlayer = async playerId => {
    const provider = core().DataProvider;
    try {
      if (provider?.getPlayer) {
        const record = await provider.getPlayer(playerId, { strict: backendMode() });
        if (record) {
          const next = adminPlayer(record, provider.isBackendActive?.() ? 'BACKEND' : 'LOCAL');
          globalPlayers = [...globalPlayers.filter(player => String(player.id) !== String(playerId)), next];
        }
      }
    } catch (error) {
      if (backendMode()) globalPlayers = globalPlayers.filter(player => String(player.id) !== String(playerId));
      throw error;
    }
    return selectedPlayer(playerId);
  };
  const games = () => {
    const data = read(), stats = data.statistics || {}, localRows = [currentPlayer()], rows = backendMode() ? globalPlayers : localRows, launches = stats.launchesByGame || {}, records = data.records || {}, tx = transactions();
    return catalog().map(game => {
      const aggregate = rows.reduce((result, player) => { const playerRecord = player.records?.[game.id] || {}; result.sessions += Number(playerRecord.gamesPlayed || player.statistics?.launchesByGame?.[game.id] || 0); result.totalScore += Number(playerRecord.totalScore || 0); result.completed += Number(playerRecord.completedGames || 0); result.playTime += Number(playerRecord.playTime || 0); return result; }, { sessions: 0, totalScore: 0, completed: 0, playTime: 0 });
      const record = records[game.id] || {}, sessions = aggregate.sessions || Number(record.gamesPlayed || launches[game.id] || 0), totalScore = aggregate.totalScore || Number(record.totalScore || 0), gameRewards = tx.filter(item => item.source === game.id || item.metadata?.gameId === game.id).reduce((sum, item) => item.type === 'earn' ? sum + currency(item.amount) : sum, 0);
      return { id: game.id, title: game.title, launches: Number(launches[game.id] || sessions), completed: Number(aggregate.completed || record.completedGames || (record.lastResult?.completed ? sessions : 0)), averageScore: sessions ? Math.round(totalScore / sessions) : Number(record.bestScore || 0), averagePlayTime: sessions ? Math.round(Number(aggregate.playTime || record.playTime || 0) / sessions) : 0, rewardsGiven: gameRewards };
    });
  };
  const shop = () => {
    const data = read(), profileHistory = data.inventory?.profile?.purchaseHistory || [], profileItems = manager()?.list?.('all') || [], gameItems = (manager()?.gameShops?.() || []).flatMap(shopInfo => { const gameShop = window.TelePlayGameShops?.[shopInfo.gameId], history = data.inventory?.games?.[shopInfo.gameId]?.purchaseHistory || []; return (gameShop?.getItems?.('all') || []).map(item => ({ ...item, gameId: shopInfo.gameId, purchasesCount: history.filter(entry => entry.itemId === item.id).length })); });
    return [...profileItems.map(item => ({ ...item, purchasesCount: profileHistory.filter(entry => entry.itemId === item.id).length })), ...gameItems];
  };
  const security = () => ({ proofs: [...globalRewardProofs], results: [...globalGameResults], fraudEvents: [...globalFraudEvents] });
  const payments = () => [...globalPayments];
  const AdminData = { currentPlayer, dashboard, playerRows, loadPlayers, loadGlobal, loadPlayer, selectedPlayer, globalPlayers: () => [...globalPlayers], globalStatus: () => ({ ...globalLoad }), economy, games, shop, security, payments, events: () => backendMode() ? [...globalEvents].reverse() : (window.TelePlayAdmin?.Log?.events?.() || []), actions: () => backendMode() ? [...globalActions].reverse() : (window.TelePlayAdmin?.Log?.actions?.() || []), dateTime };
  window.TelePlayAdmin = window.TelePlayAdmin || {};
  window.TelePlayAdmin.Data = AdminData;
})();
