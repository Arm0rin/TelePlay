(() => {
  const core = () => window.TelePlayCore || {};
  const config = () => window.TelePlayDataConfig || { mode: 'local', backendUrl: '', endpoints: {} };
  const model = () => window.TelePlayDataModel || { toRecord: value => value, fromRecord: value => value };
  const clone = value => { try { return JSON.parse(JSON.stringify(value ?? {})); } catch (_) { return {}; } };
  const id = prefix => `${prefix}:${Date.now()}:${Math.random().toString(36).slice(2, 9)}`;
  const queryString = params => {
    const query = new URLSearchParams();
    Object.entries(params || {}).forEach(([key, value]) => { if (value != null && value !== '') query.set(key, String(value)); });
    const result = query.toString(); return result ? `?${result}` : '';
  };
  const currentId = () => String(core().PlayerData?.get?.().profile?.id || core().TelegramAuth?.identity?.().telegramId || 'guest');
  const hasMeaningfulLocalData = snapshot => {
    const state = snapshot || {}, stats = state.statistics || {}, inventory = state.inventory || {};
    const ownedProfile = inventory.profile?.ownedItems || inventory.ownedItems || [];
    const ownedGames = Object.values(inventory.games || {}).some(scope => (scope?.ownedItems || []).length > 0);
    return Number(state.coins || 0) > 0 || Number(state.gems || state.teleGems || 0) > 0 || Number(state.progress?.totalXP || state.progress?.xp || 0) > 0 || Number(stats.totalGames || stats.gamesPlayed || 0) > 0 || Object.keys(state.records || {}).length > 0 || (state.achievements?.unlockedAchievements || []).length > 0 || ownedProfile.some(item => item !== 'avatar-frame-neon') || ownedGames;
  };
  const migrationSummary = snapshot => ({
    coins: Math.max(0, Number(snapshot?.coins || 0)),
    gems: Math.max(0, Number(snapshot?.gems || snapshot?.teleGems || 0)),
    level: Math.max(1, Number(snapshot?.progress?.level || 1)),
    totalXP: Math.max(0, Number(snapshot?.progress?.totalXP || snapshot?.progress?.xp || 0)),
    items: (snapshot?.inventory?.profile?.ownedItems || []).length + Object.values(snapshot?.inventory?.games || {}).reduce((sum, scope) => sum + (scope?.ownedItems || []).length, 0),
    achievements: (snapshot?.achievements?.unlockedAchievements || []).length
  });

  class ProviderError extends Error {
    constructor(code, { status = 0, userMessage = '', retryable = false, cause = null } = {}) {
      super(code); this.name = 'ProviderError'; this.code = code; this.status = status; this.userMessage = userMessage; this.retryable = retryable; this.cause = cause;
    }
  }
  const friendlyError = error => {
    const code = error?.code || error?.message || 'backend_error';
    if (['telegram_auth_required', 'telegram_auth_invalid', 'telegram_auth_expired', 'backend_http_401'].includes(code)) return 'Открой TelePlay через Telegram, чтобы синхронизировать профиль.';
    if (code === 'backend_url_missing') return 'Не удалось загрузить профиль. Повторяем подключение…';
    if (['backend_timeout', 'backend_unavailable', 'health_check_failed'].includes(code)) return 'Не удалось загрузить профиль. Повторяем подключение…';
    if (code === 'sync_failed') return 'Не удалось синхронизировать прогресс. Повторяем подключение…';
    return 'Не удалось загрузить профиль. Повторяем подключение…';
  };

  class LocalStorageProvider {
    constructor() { this.kind = 'local'; }
    getCurrentPlayerSync() { return core().SaveManager?.read?.() || {}; }
    savePlayer(snapshot) { return core().SaveManager?.write?.(snapshot) || snapshot; }
    syncCurrentPlayer() { return Promise.resolve(this.getCurrentPlayerSync()); }
    normalizeRecord(value) { return model().toRecord(value); }
    localPlayerRows() { return [this.normalizeRecord(this.getCurrentPlayerSync())]; }
    listPlayers(options = {}) { return Promise.resolve(this.filterPlayers(this.localPlayerRows(), options)); }
    filterPlayers(rows, options = {}) {
      const query = String(options.query || '').trim().toLowerCase().replace(/^@/, ''), filters = options.filters || {};
      return rows.filter(player => {
        const matchesQuery = !query || String(player.telegramId || '').toLowerCase().includes(query) || String(player.username || '').toLowerCase().includes(query);
        const created = player.createdAt ? new Date(player.createdAt).toISOString().slice(0, 10) : '', active = player.lastActive ? new Date(player.lastActive).toISOString().slice(0, 10) : '', today = new Date().toISOString().slice(0, 10);
        if ((filters.newPlayers || options.filter === 'new') && created !== today) return false;
        if ((filters.activeToday || options.filter === 'active') && active !== today) return false;
        return matchesQuery;
      });
    }
    getPlayer(playerId) { return Promise.resolve(this.localPlayerRows().find(player => String(player.telegramId) === String(playerId)) || null); }
    normalizeTransaction(item) { return { ...clone(item), playerId: item.playerId || currentId(), currency: item.currency || item.currencyType || 'coins', amount: Number(item.amount || 0) }; }
    getTransactions(options = {}) { const history = this.getCurrentPlayerSync().currencyTransactions || []; return Promise.resolve(history.map(item => this.normalizeTransaction(item)).filter(item => !options.playerId || String(item.playerId) === String(options.playerId))); }
    getAnalyticsEventsSync() { return [...(this.getCurrentPlayerSync().analyticsEvents || [])].map(item => ({ ...clone(item), playerId: item.playerId || currentId(), timestamp: item.timestamp || item.createdAt })); }
    getAdminActionsSync() { return [...(this.getCurrentPlayerSync().adminActionLog || [])].map(item => ({ ...clone(item), targetPlayer: item.targetPlayer || currentId() })); }
    getRewardProofs() { return Promise.resolve([]); }
    getGameResults() { return Promise.resolve([]); }
    getFraudEvents() { return Promise.resolve([]); }
    getAnalyticsEvents() { return Promise.resolve(this.getAnalyticsEventsSync()); }
    getAdminActions() { return Promise.resolve(this.getAdminActionsSync()); }
    append(key, entry) { const save = this.getCurrentPlayerSync(), history = Array.isArray(save[key]) ? save[key] : []; this.savePlayer({ ...save, [key]: [...history, entry].slice(-300) }); return entry; }
    recordAnalyticsEvent(entry) { return this.append('analyticsEvents', { id: entry.id || id('event'), playerId: entry.playerId || currentId(), event: String(entry.event || 'unknown'), timestamp: entry.timestamp || Date.now(), metadata: clone(entry.metadata || entry.params || {}) }); }
    recordAdminAction(entry) { return this.append('adminActionLog', { id: entry.id || id('admin'), ...clone(entry), targetPlayer: entry.targetPlayer || currentId(), timestamp: entry.timestamp || Date.now() }); }
    postAdminAction(entry) { return Promise.resolve(this.recordAdminAction(entry)); }
    postAnalyticsEvent(entry) { return Promise.resolve(this.recordAnalyticsEvent(entry)); }
  }

  let activeProvider, state;
  const notifyState = patch => {
    state = { ...state, ...patch, updatedAt: Date.now() };
    try { window.dispatchEvent(new CustomEvent('teleplay:data-status', { detail: clone(state) })); } catch (_) {}
    return state;
  };

  class BackendProvider {
    constructor(local) { this.kind = 'backend'; this.local = local; this.syncTimer = null; this.currencyQueue = Promise.resolve(); this.active = false; this.initialLocalSnapshot = clone(local.getCurrentPlayerSync()); }
    getCurrentPlayerSync() { return this.local.getCurrentPlayerSync(); }
    savePlayer(snapshot) {
      const saved = this.local.savePlayer({ ...snapshot, serverSync: { ...(snapshot.serverSync || {}), pending: this.active, updatedAt: Date.now() } });
      if (this.active) this.queueStateSync(saved);
      return saved;
    }
    async request(path, options = {}) {
      const base = config().backendUrl;
      if (!base) throw new ProviderError('backend_url_missing', { userMessage: friendlyError({ code: 'backend_url_missing' }) });
      if (typeof fetch !== 'function') throw new ProviderError('backend_unavailable', { retryable: true, userMessage: friendlyError({ code: 'backend_unavailable' }) });
      const requiresAuth = options.requiresAuth !== false, auth = core().TelegramAuth;
      if (requiresAuth && !auth?.initData?.()) throw new ProviderError('telegram_auth_required', { status: 401, userMessage: friendlyError({ code: 'telegram_auth_required' }) });
      const controller = typeof AbortController === 'function' ? new AbortController() : null;
      const timeoutMs = Number(options.timeoutMs || config().requestTimeoutMs || 8000), timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
      const headers = requiresAuth ? (auth?.headers?.({ 'Content-Type': 'application/json' }) || {}) : { Accept: 'application/json', 'Content-Type': 'application/json' };
      try {
        const response = await fetch(`${base}${path}`, { ...options, signal: controller?.signal, headers: { ...headers, ...(options.headers || {}) } });
        let payload = null; try { payload = response.status === 204 ? null : await response.json(); } catch (_) {}
        if (!response.ok) {
          const code = payload?.error || `backend_http_${response.status}`;
          throw new ProviderError(code, { status: response.status, retryable: response.status >= 500, userMessage: friendlyError({ code }) });
        }
        return payload;
      } catch (error) {
        if (error instanceof ProviderError) throw error;
        const timeout = error?.name === 'AbortError';
        throw new ProviderError(timeout ? 'backend_timeout' : 'backend_unavailable', { retryable: true, cause: error, userMessage: friendlyError({ code: timeout ? 'backend_timeout' : 'backend_unavailable' }) });
      } finally { if (timer) clearTimeout(timer); }
    }
    async healthCheck() {
      const payload = await this.request(config().endpoints.health || '/health', { method: 'GET', requiresAuth: false, timeoutMs: config().healthTimeoutMs });
      if (!(payload?.status === 'ok' || payload?.ok === true)) throw new ProviderError('health_check_failed', { retryable: true, userMessage: friendlyError({ code: 'health_check_failed' }) });
      return payload;
    }
    hydrate(record, current = this.getCurrentPlayerSync()) {
      const next = model().fromRecord(record, current);
      return this.local.savePlayer({ ...next, serverSync: { pending: false, syncedAt: Date.now() } });
    }
    transactionBody(entry) { return { id: entry.id, currencyType: entry.currencyType || entry.currency || 'coins', type: entry.type === 'spend' ? 'spend' : 'earn', amount: Math.abs(Number(entry.amount || 0)), source: entry.source || 'system', metadata: entry.metadata || {} }; }
    queueOfflineTransaction(entry) {
      const body = this.transactionBody(entry), current = this.local.getCurrentPlayerSync(), pendingTransactions = [...(current.serverSync?.pendingTransactions || []).filter(item => item.id !== body.id), body];
      this.local.savePlayer({ ...current, serverSync: { ...(current.serverSync || {}), pendingTransactions, pending: true, updatedAt: Date.now() } });
      return null;
    }
    queueOfflineAnalytics(entry, recordLocal = true) {
      const saved = recordLocal ? this.local.recordAnalyticsEvent(entry) : entry, current = this.local.getCurrentPlayerSync(), value = { ...clone(entry), id: entry.id || saved?.id || id('event'), timestamp: entry.timestamp || entry.createdAt || Date.now() }, pendingAnalytics = [...(current.serverSync?.pendingAnalytics || []).filter(item => item.id !== value.id), value];
      this.local.savePlayer({ ...current, serverSync: { ...(current.serverSync || {}), pendingAnalytics, pending: true, updatedAt: Date.now() } });
      return value;
    }
    queueOfflineSession(entry) {
      const current = this.local.getCurrentPlayerSync(), value = clone(entry), key = `${value.id}:${value.finishedAt ? 'finish' : 'start'}`, pendingSessions = [...(current.serverSync?.pendingSessions || []).filter(item => `${item.id}:${item.finishedAt ? 'finish' : 'start'}` !== key), value];
      this.local.savePlayer({ ...current, serverSync: { ...(current.serverSync || {}), pendingSessions, pending: true, updatedAt: Date.now() } });
      return null;
    }
    permanentTransactionError(error) {
      return ['server_reward_required', 'invalid_shop_item', 'invalid_shop_price', 'invalid_shop_source', 'free_item', 'item_already_owned', 'insufficient_balance', 'invalid_amount', 'invalid_transaction_source', 'invalid_transaction_type'].includes(error?.code);
    }
    async replayPendingWrites() {
      const current = this.local.getCurrentPlayerSync(), pending = Array.isArray(current?.serverSync?.pendingTransactions) ? current.serverSync.pendingTransactions : [];
      for (const body of pending) {
        let payload;
        try {
          payload = await this.request(config().endpoints.transactions, { method: 'POST', headers: { 'X-Idempotency-Key': String(body.id || '') }, body: JSON.stringify(body) });
        } catch (error) {
          if (!this.permanentTransactionError(error)) throw error;
          const latest = this.local.getCurrentPlayerSync(), remaining = (latest.serverSync?.pendingTransactions || []).filter(item => item.id !== body.id);
          this.local.savePlayer({ ...latest, serverSync: { ...(latest.serverSync || {}), pendingTransactions: remaining, pending: remaining.length > 0 || (latest.serverSync?.pendingAnalytics || []).length > 0 || (latest.serverSync?.pendingSessions || []).length > 0, syncedAt: Date.now(), lastRejectedTransaction: error.code } });
          continue;
        }
        const latest = this.local.getCurrentPlayerSync(), remaining = (latest.serverSync?.pendingTransactions || []).filter(item => item.id !== body.id), currency = body.currencyType === 'gems' ? 'gems' : 'coins';
        this.local.savePlayer({ ...latest, ...(payload?.balance != null ? { [currency]: Number(payload.balance) } : {}), serverSync: { ...(latest.serverSync || {}), pendingTransactions: remaining, pending: remaining.length > 0 || (latest.serverSync?.pendingAnalytics || []).length > 0 || (latest.serverSync?.pendingSessions || []).length > 0, syncedAt: Date.now() } });
      }
      const analytics = [...(this.local.getCurrentPlayerSync().serverSync?.pendingAnalytics || [])];
      for (const entry of analytics) {
        await this.request(config().endpoints.analytics, { method: 'POST', headers: { 'X-Idempotency-Key': String(entry.id || '') }, body: JSON.stringify({ ...entry, playerId: undefined }) });
        const latest = this.local.getCurrentPlayerSync(), pendingAnalytics = (latest.serverSync?.pendingAnalytics || []).filter(item => item.id !== entry.id);
        this.local.savePlayer({ ...latest, serverSync: { ...(latest.serverSync || {}), pendingAnalytics, pending: pendingAnalytics.length > 0 || (latest.serverSync?.pendingTransactions || []).length > 0 || (latest.serverSync?.pendingSessions || []).length > 0, syncedAt: Date.now() } });
      }
      const sessions = [...(this.local.getCurrentPlayerSync().serverSync?.pendingSessions || [])];
      for (const entry of sessions) {
        await this.request(config().endpoints.gameSessions || '/game-sessions', { method: 'POST', headers: { 'X-Idempotency-Key': String(entry.id || '') }, body: JSON.stringify({ ...entry, playerId: undefined }) });
        const latest = this.local.getCurrentPlayerSync(), key = `${entry.id}:${entry.finishedAt ? 'finish' : 'start'}`, pendingSessions = (latest.serverSync?.pendingSessions || []).filter(item => `${item.id}:${item.finishedAt ? 'finish' : 'start'}` !== key);
        this.local.savePlayer({ ...latest, serverSync: { ...(latest.serverSync || {}), pendingSessions, pending: pendingSessions.length > 0 || (latest.serverSync?.pendingTransactions || []).length > 0 || (latest.serverSync?.pendingAnalytics || []).length > 0, syncedAt: Date.now() } });
      }
      const results = [...(this.local.getCurrentPlayerSync().serverSync?.pendingGameResults || [])];
      for (const entry of results) {
        const payload = await this.submitGameResult(entry);
        if (!payload) continue;
        const latest = this.local.getCurrentPlayerSync(), pendingGameResults = (latest.serverSync?.pendingGameResults || []).filter(item => item.sessionId !== entry.sessionId);
        this.local.savePlayer({ ...latest, serverSync: { ...(latest.serverSync || {}), pendingGameResults, pending: pendingGameResults.length > 0 || (latest.serverSync?.pendingTransactions || []).length > 0 || (latest.serverSync?.pendingAnalytics || []).length > 0 || (latest.serverSync?.pendingSessions || []).length > 0, syncedAt: Date.now() } });
      }
    }
    async pullCurrentPlayer() { const payload = await this.request(config().endpoints.me, { method: 'GET' }); return payload?.player || null; }
    async createCurrentPlayer() {
      const payload = await this.request(config().endpoints.me, { method: 'POST', body: '{}' });
      if (!payload?.player) throw new ProviderError('player_create_failed', { userMessage: friendlyError({ code: 'backend_error' }) });
      this.active = true; return this.hydrate(payload.player, this.getCurrentPlayerSync());
    }
    async importLocalPlayer(snapshot = this.initialLocalSnapshot) {
      const payload = await this.request(config().endpoints.meImport || '/players/me/import', { method: 'POST', body: JSON.stringify({ migrationId: id('local-migration'), migrationVersion: 'local-v1', snapshot: model().toRecord(snapshot) }) });
      if (!payload?.player) throw new ProviderError('player_import_failed', { userMessage: 'Не удалось загрузить профиль. Повторяем подключение…', retryable: true });
      this.active = true; return { snapshot: this.hydrate(payload.player, snapshot), imported: Boolean(payload.imported) };
    }
    async pushState(snapshot = this.getCurrentPlayerSync()) {
      if (!this.active) return null;
      try {
        // Purchases update the local inventory synchronously. Ensure their
        // authoritative currency transaction reaches the server first, so
        // inventory verification can see the matching itemId.
        await this.currencyQueue;
        await this.replayPendingWrites();
        const payload = await this.request(config().endpoints.meState || '/players/me/state', { method: 'PUT', headers: { 'X-Idempotency-Key': id('sync') }, body: JSON.stringify(model().toRecord(snapshot)) });
        const saved = payload?.player ? this.hydrate(payload.player, snapshot) : this.local.savePlayer({ ...snapshot, serverSync: { pending: false, syncedAt: Date.now() } });
        notifyState({ phase: 'online', activeMode: 'backend', healthy: true, fallback: false, message: '', lastError: null });
        return saved;
      } catch (error) {
        this.local.savePlayer({ ...snapshot, serverSync: { pending: true, updatedAt: Date.now(), error: error.code || 'sync_failed' } });
        notifyState({ phase: 'degraded', activeMode: 'backend', healthy: false, fallback: true, message: friendlyError({ code: 'sync_failed' }), lastError: error.code || 'sync_failed' });
        return null;
      }
    }
    queueStateSync(snapshot) { clearTimeout(this.syncTimer); this.syncTimer = setTimeout(() => { this.pushState(snapshot).catch(() => {}); }, Number(config().syncDebounceMs || 350)); }
    async initialize() {
      await this.healthCheck();
      const identity = core().TelegramAuth?.identity?.() || {};
      if (!identity.authenticated || !identity.telegramId) throw new ProviderError('telegram_auth_required', { status: 401, userMessage: friendlyError({ code: 'telegram_auth_required' }) });
      try {
        const remote = await this.pullCurrentPlayer();
        this.active = true;
        if (this.getCurrentPlayerSync()?.serverSync?.pending) return { status: 'online', snapshot: await this.pushState(this.getCurrentPlayerSync()), restoredPending: true };
        if (hasMeaningfulLocalData(this.initialLocalSnapshot)) {
          const migrated = await this.importLocalPlayer(this.initialLocalSnapshot);
          return { status: 'online', snapshot: migrated.snapshot, migrated: migrated.imported };
        }
        return { status: 'online', snapshot: this.hydrate(remote, this.getCurrentPlayerSync()) };
      } catch (error) {
        if (error.status !== 404 && error.code !== 'player_not_found') throw error;
        const created = await this.createCurrentPlayer();
        if (hasMeaningfulLocalData(this.initialLocalSnapshot)) {
          const migrated = await this.importLocalPlayer(this.initialLocalSnapshot);
          return { status: 'online', snapshot: migrated.snapshot, created: true, migrated: migrated.imported };
        }
        return { status: 'online', snapshot: created, created: true, migrated: false };
      }
    }
    async syncCurrentPlayer() { const remote = await this.pullCurrentPlayer(); this.active = true; return this.hydrate(remote, this.getCurrentPlayerSync()); }
    async remoteOrFallback(action, fallback, options = {}) { if (!this.active && !options.strict) return fallback(); try { return await action(); } catch (error) { if (options.strict) throw error; return fallback(); } }
    listPlayers(options = {}) { return this.remoteOrFallback(async () => { const payload = await this.request(`${config().endpoints.players}${queryString({ q: options.query, sort: options.sort, filter: options.filter })}`, { method: 'GET' }); return (Array.isArray(payload) ? payload : payload?.players || []).map(value => model().toRecord(model().fromRecord(value, {}))); }, () => this.local.listPlayers(options), options); }
    getPlayer(playerId, options = {}) { return this.remoteOrFallback(async () => { const payload = await this.request(`${config().endpoints.players}/${encodeURIComponent(playerId)}`, { method: 'GET' }); return payload?.player || payload || null; }, () => this.local.getPlayer(playerId), options); }
    getTransactions(options = {}) { return this.remoteOrFallback(async () => { const payload = await this.request(`${config().endpoints.transactions}${queryString({ playerId: options.playerId })}`, { method: 'GET' }); return Array.isArray(payload) ? payload : payload?.transactions || []; }, () => this.local.getTransactions(options), options); }
    getAnalyticsEvents(options = {}) { return this.remoteOrFallback(async () => { const payload = await this.request(`${config().endpoints.analytics}${queryString({ playerId: options.playerId })}`, { method: 'GET' }); return Array.isArray(payload) ? payload : payload?.events || []; }, () => this.local.getAnalyticsEvents(options), options); }
    getAdminActions(options = {}) { return this.remoteOrFallback(async () => { const payload = await this.request(`${config().endpoints.adminActions}${queryString({ playerId: options.playerId })}`, { method: 'GET' }); return Array.isArray(payload) ? payload : payload?.actions || []; }, () => this.local.getAdminActions(options), options); }
    getRewardProofs(options = {}) { return this.remoteOrFallback(async () => { const payload = await this.request(`${config().endpoints.rewardProofs || '/reward-proofs'}${queryString({ playerId: options.playerId, status: options.status })}`, { method: 'GET' }); return Array.isArray(payload) ? payload : payload?.proofs || []; }, () => [], options); }
    getGameResults(options = {}) { return this.remoteOrFallback(async () => { const payload = await this.request(`${config().endpoints.gameResultsAdmin || '/game-results'}${queryString({ playerId: options.playerId, validated: options.validated })}`, { method: 'GET' }); return Array.isArray(payload) ? payload : payload?.results || []; }, () => [], options); }
    getFraudEvents(options = {}) { return this.remoteOrFallback(async () => { const payload = await this.request(`${config().endpoints.fraudEvents || '/fraud-events'}${queryString({ playerId: options.playerId })}`, { method: 'GET' }); return Array.isArray(payload) ? payload : payload?.events || []; }, () => [], options); }
    getPaymentPackages() { return this.request(config().endpoints.paymentPackages || '/payments/packages', { method: 'GET' }).then(payload => Array.isArray(payload) ? payload : payload?.packages || []); }
    createPaymentInvoice(packageId, idempotencyKey) { return this.request(config().endpoints.paymentInvoice || '/payments/invoice', { method: 'POST', headers: { 'X-Idempotency-Key': String(idempotencyKey || '') }, body: JSON.stringify({ packageId }) }); }
    getPayments(options = {}) { return this.request(`${config().endpoints.payments || '/payments'}${queryString({ playerId: options.playerId, status: options.status })}`, { method: 'GET' }).then(payload => Array.isArray(payload) ? payload : payload?.payments || []); }
    getMyPayments() { return this.request(config().endpoints.myPayments || '/payments/me', { method: 'GET' }).then(payload => Array.isArray(payload) ? payload : payload?.payments || []); }
    recordTransaction(entry) {
      if (!this.active) return Promise.resolve(null);
      const body = this.transactionBody(entry);
      const send = async () => {
        try {
          const payload = await this.request(config().endpoints.transactions, { method: 'POST', headers: { 'X-Idempotency-Key': String(body.id || '') }, body: JSON.stringify(body) });
          if (payload?.balance != null) { const current = this.local.getCurrentPlayerSync(), currency = body.currencyType === 'gems' ? 'gems' : 'coins', pendingTransactions = (current.serverSync?.pendingTransactions || []).filter(item => item.id !== body.id); this.local.savePlayer({ ...current, [currency]: Number(payload.balance), serverSync: { ...(current.serverSync || {}), pendingTransactions, pending: pendingTransactions.length > 0, syncedAt: Date.now() } }); }
          return payload;
        } catch (error) {
          const current = this.local.getCurrentPlayerSync();
          if (this.permanentTransactionError(error)) {
            const pendingTransactions = (current.serverSync?.pendingTransactions || []).filter(item => item.id !== body.id);
            this.local.savePlayer({ ...current, serverSync: { ...(current.serverSync || {}), pendingTransactions, pending: pendingTransactions.length > 0 || (current.serverSync?.pendingAnalytics || []).length > 0 || (current.serverSync?.pendingSessions || []).length > 0, syncedAt: Date.now(), lastRejectedTransaction: error.code } });
            return null;
          }
          const pendingTransactions = [...(current.serverSync?.pendingTransactions || []).filter(item => item.id !== body.id), body];
          this.local.savePlayer({ ...current, serverSync: { ...(current.serverSync || {}), pendingTransactions, pending: true, updatedAt: Date.now(), error: error.code || 'sync_failed' } });
          notifyState({ phase: 'degraded', healthy: false, fallback: true, message: friendlyError({ code: 'sync_failed' }), lastError: error.code });
          return null;
        }
      };
      this.currencyQueue = this.currencyQueue.then(send, send);
      return this.currencyQueue;
    }
    async recordGameSession(entry) { if (!this.active) return this.queueOfflineSession(entry); try { return await this.request(config().endpoints.gameSessions || '/game-sessions', { method: 'POST', headers: { 'X-Idempotency-Key': String(entry.id || '') }, body: JSON.stringify({ ...entry, playerId: undefined }) }); } catch (_) { return this.queueOfflineSession(entry); } }
    async submitGameResult(entry) {
      if (!this.active) return null;
      const body = { gameId: entry.gameId, sessionId: entry.sessionId, score: Number(entry.score || 0), duration: Number(entry.duration || 0), metadata: clone(entry.metadata || entry.result || {}), timestamp: Number(entry.timestamp || Date.now()) };
      try {
        const payload = await this.request(config().endpoints.gameResults || '/games/result', { method: 'POST', headers: { 'X-Idempotency-Key': `reward:${body.sessionId}` }, body: JSON.stringify(body) });
        if (payload?.player) this.hydrate(payload.player, this.getCurrentPlayerSync());
        if (payload?.rewardProof) core().RewardManager?.award?.(entry.gameId, { rewardProof: payload.rewardProof });
        return payload;
      } catch (error) {
        if (error?.code === 'result_rejected' || error?.status === 422 || error?.code === 'session_forbidden' || error?.code === 'result_session_mismatch') {
          try { window.dispatchEvent(new CustomEvent('teleplay:reward-rejected', { detail: { ...body, code: error.code } })); } catch (_) {}
          return null;
        }
        const current = this.local.getCurrentPlayerSync(), pending = [...(current.serverSync?.pendingGameResults || []).filter(item => item.sessionId !== body.sessionId), body];
        this.local.savePlayer({ ...current, serverSync: { ...(current.serverSync || {}), pendingGameResults: pending, pending: true, updatedAt: Date.now(), error: error.code || 'reward_sync_failed' } });
        notifyState({ phase: 'degraded', healthy: false, fallback: true, message: friendlyError({ code: 'sync_failed' }), lastError: error.code || 'reward_sync_failed' });
        return null;
      }
    }
    getAnalyticsEventsSync() { return this.local.getAnalyticsEventsSync(); }
    getAdminActionsSync() { return this.local.getAdminActionsSync(); }
    async postAdminAction(entry) { const local = this.local.recordAdminAction(entry); if (!this.active) return null; return this.request(config().endpoints.adminActions, { method: 'POST', body: JSON.stringify({ ...entry, adminId: core().TelegramAuth?.identity?.().telegramId || entry.adminId }) }); }
    async postAnalyticsEvent(entry) { const local = this.local.recordAnalyticsEvent(entry); if (!this.active) return local; try { await this.request(config().endpoints.analytics, { method: 'POST', headers: { 'X-Idempotency-Key': String(entry.id || '') }, body: JSON.stringify({ ...entry, playerId: undefined }) }); } catch (_) { this.queueOfflineAnalytics(entry, false); } return local; }
    recordAnalyticsEvent(entry) { this.postAnalyticsEvent(entry).catch(() => {}); return entry; }
    recordAdminAction(entry) { this.postAdminAction(entry).catch(() => {}); return entry; }
  }

  const local = new LocalStorageProvider(), backend = new BackendProvider(local), configuredBackend = config().mode === 'backend';
  activeProvider = local;
  state = { configuredMode: config().mode, activeMode: 'local', phase: 'idle', healthy: false, fallback: false, message: '', lastError: null, updatedAt: Date.now() };
  // Administrative reads must never be silently substituted with the owner's
  // local save.  A configured backend can be retried directly with `strict`
  // even if the gameplay provider is temporarily in its graceful fallback.
  const readProvider = () => configuredBackend ? backend : activeProvider;
  const activateBackend = patch => { activeProvider = backend; backend.active = true; notifyState({ activeMode: 'backend', phase: 'online', healthy: true, fallback: false, message: '', lastError: null, ...patch }); };
  const activateFallback = (error, phase = 'offline') => { activeProvider = local; backend.active = false; return notifyState({ activeMode: 'local', phase, healthy: false, fallback: configuredBackend, message: error?.userMessage || friendlyError(error || {}), lastError: error?.code || error?.message || 'backend_unavailable' }); };

  const DataProvider = {
    get provider() { return activeProvider; },
    mode: config().mode,
    configuredMode: config().mode,
    isBackendEnabled: () => configuredBackend,
    isBackendActive: () => activeProvider === backend && backend.active,
    status: () => clone(state),
    async initialize() {
      notifyState({ phase: 'checking', message: '', lastError: null });
      if (!configuredBackend) { activeProvider = local; notifyState({ phase: 'ready', activeMode: 'local', healthy: true, fallback: false }); return { status: 'local', snapshot: local.getCurrentPlayerSync() }; }
      if (!config().backendUrl) { const error = new ProviderError('backend_url_missing', { userMessage: friendlyError({ code: 'backend_url_missing' }) }); activateFallback(error, 'misconfigured'); return { status: 'fallback', error, snapshot: local.getCurrentPlayerSync() }; }
      try {
        const result = await backend.initialize();
        activateBackend(); return result;
      } catch (error) {
        activateFallback(error);
        if (!config().allowLocalFallback) throw error;
        return { status: 'fallback', error, snapshot: local.getCurrentPlayerSync() };
      }
    },
    async importLocalPlayer() { try { const result = await backend.importLocalPlayer(); activateBackend({ imported: true }); return { ok: true, ...result }; } catch (error) { activateFallback(error, 'migration_failed'); return { ok: false, error }; } },
    async createRemotePlayer() { try { const snapshot = await backend.createCurrentPlayer(); activateBackend({ created: true }); return { ok: true, snapshot }; } catch (error) { activateFallback(error); return { ok: false, error }; } },
    continueLocal() { return activateFallback(new ProviderError('migration_deferred', { userMessage: 'Серверный импорт отложен. Прогресс сохраняется на устройстве.' }), 'local_only'); },
    async retry() { return this.initialize(); },
    healthCheck: () => backend.healthCheck(),
    getCurrentPlayerSync: () => activeProvider.getCurrentPlayerSync(),
    savePlayer: snapshot => {
      if (activeProvider === backend) return backend.savePlayer(snapshot);
      if (!configuredBackend) return local.savePlayer(snapshot);
      return local.savePlayer({ ...snapshot, serverSync: { ...(snapshot.serverSync || {}), pending: true, updatedAt: Date.now() } });
    },
    syncCurrentPlayer: () => activeProvider.syncCurrentPlayer(),
    listPlayers: options => readProvider().listPlayers(options),
    getPlayer: (playerId, options) => readProvider().getPlayer(playerId, options),
    getTransactions: options => readProvider().getTransactions(options),
    getAnalyticsEvents: options => readProvider().getAnalyticsEvents(options),
    getAdminActions: options => readProvider().getAdminActions(options),
    getRewardProofs: options => readProvider().getRewardProofs(options),
    getGameResults: options => readProvider().getGameResults(options),
    getFraudEvents: options => readProvider().getFraudEvents(options),
    getPaymentPackages: () => backend.getPaymentPackages(),
    createPaymentInvoice: (packageId, idempotencyKey) => backend.createPaymentInvoice(packageId, idempotencyKey),
    getPayments: options => backend.getPayments({ ...(options || {}), strict: true }),
    getMyPayments: () => backend.getMyPayments(),
    getAnalyticsEventsSync: () => activeProvider.getAnalyticsEventsSync(),
    getAdminActionsSync: () => activeProvider.getAdminActionsSync(),
    recordAnalyticsEvent: entry => activeProvider === backend ? backend.recordAnalyticsEvent(entry) : (configuredBackend ? backend.queueOfflineAnalytics(entry) : local.recordAnalyticsEvent(entry)),
    recordAdminAction: entry => activeProvider.recordAdminAction(entry),
    postAdminAction: entry => activeProvider.postAdminAction(entry),
    postAnalyticsEvent: entry => activeProvider === backend ? backend.postAnalyticsEvent(entry) : (configuredBackend ? Promise.resolve(backend.queueOfflineAnalytics(entry)) : local.postAnalyticsEvent(entry)),
    recordTransaction: entry => activeProvider === backend ? backend.recordTransaction(entry) : (configuredBackend ? Promise.resolve(backend.queueOfflineTransaction(entry)) : undefined),
    recordGameSession: entry => activeProvider === backend ? backend.recordGameSession(entry) : (configuredBackend ? Promise.resolve(backend.queueOfflineSession(entry)) : undefined),
    submitGameResult: entry => activeProvider === backend ? backend.submitGameResult(entry) : undefined,
    databaseSchema: () => window.TelePlayDataModel?.schema || {},
    migrationSummary: () => migrationSummary(backend.initialLocalSnapshot)
  };
  window.TelePlayProviders = { LocalStorageProvider, BackendProvider, ProviderError };
  window.TelePlayCore ??= {};
  window.TelePlayCore.DataProvider = DataProvider;
  window.TelePlayDataProvider = DataProvider;
})();
