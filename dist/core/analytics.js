(() => {
  const SCHEMA_VERSION = '2026-09';
  const SESSION_KEY = 'teleplay-product-session-id';
  const MAX_DEPTH = 3;
  const MAX_KEYS = 24;
  const MAX_STRING_LENGTH = 160;
  let memorySessionId = '';

  const id = prefix => `${prefix}:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;
  const compact = value => String(value ?? '').trim().slice(0, MAX_STRING_LENGTH);
  const sessionId = () => {
    try {
      const existing = sessionStorage.getItem(SESSION_KEY);
      if (existing) return existing;
      const next = id('launch');
      sessionStorage.setItem(SESSION_KEY, next);
      return next;
    } catch (_) {
      memorySessionId ||= id('launch');
      return memorySessionId;
    }
  };
  const safeValue = (value, depth = 0) => {
    if (value == null || typeof value === 'boolean') return value;
    if (typeof value === 'number') return Number.isFinite(value) ? Math.round(value * 1000) / 1000 : undefined;
    if (typeof value === 'string') return compact(value);
    if (depth >= MAX_DEPTH || typeof value !== 'object' || Array.isArray(value)) return undefined;
    return Object.entries(value).slice(0, MAX_KEYS).reduce((result, [key, item]) => {
      const next = safeValue(item, depth + 1);
      if (next !== undefined) result[compact(key)] = next;
      return result;
    }, {});
  };
  const startParam = () => {
    const tgParam = window.Telegram?.WebApp?.initDataUnsafe?.start_param;
    const queryParam = new URLSearchParams(window.location?.search || '').get('startapp');
    return compact(tgParam || queryParam || '');
  };
  const context = () => {
    const tg = window.Telegram?.WebApp;
    const viewportWidth = Number(tg?.viewportStableWidth || window.innerWidth || 0);
    const viewportHeight = Number(tg?.viewportStableHeight || window.innerHeight || 0);
    return {
      schemaVersion: SCHEMA_VERSION,
      launchSessionId: sessionId(),
      platform: compact(tg?.platform || 'web'),
      telegramVersion: compact(tg?.version || ''),
      colorScheme: compact(tg?.colorScheme || ''),
      language: compact(window.navigator?.language || ''),
      viewport: `${Math.round(viewportWidth)}x${Math.round(viewportHeight)}`,
      startParam: startParam() || undefined
    };
  };
  const payload = (gameId, params) => {
    const detail = safeValue(params) || {};
    return {
      ...detail,
      gameId: gameId || detail.gameId || null,
      telemetry: { ...context(), ...(detail.telemetry || {}) }
    };
  };
  const emit = (event, gameId, params) => {
    const detail = payload(gameId, params);
    if (window.TelePlayGameShell?.emit) return window.TelePlayGameShell.emit(event, detail);
    if (window.TelePlayCore?.GameSession?.handleEvent) return window.TelePlayCore.GameSession.handleEvent(event, detail.gameId, detail);
    window.TelePlayCore?.PlayerData?.handleEvent?.(event, detail.gameId, detail);
    const eventPayload = { event, at: Date.now(), ...detail };
    window.dispatchEvent?.(new CustomEvent(`teleplay:${event}`, { detail: eventPayload }));
    window.dataLayer?.push(eventPayload);
    return eventPayload;
  };
  const Analytics = {
    schemaVersion: SCHEMA_VERSION,
    sessionId,
    context,
    track(event, gameId = null, params = {}) { return emit(compact(event) || 'unknown', gameId, params); },
    appOpened(params = {}) { return Analytics.track('app_opened', null, params); },
    appReady(params = {}) { return Analytics.track('app_ready', null, params); },
    catalogViewed(params = {}) { return Analytics.track('catalog_viewed', null, params); },
    gameOpened: gameId => Analytics.track('game_opened', gameId),
    gameStarted: (gameId, params = {}) => Analytics.track('game_started', gameId, params),
    gameFinished: (gameId, params) => Analytics.track('game_finished', gameId, params),
    gameRestarted: gameId => Analytics.track('game_restarted', gameId),
    gamePaused: gameId => Analytics.track('game_paused', gameId),
    newRecord: (gameId, params) => Analytics.track('new_record', gameId, params),
    coinsEarned: (gameId, params) => Analytics.track('coins_earned', gameId, params),
    levelCompleted: (gameId, params) => Analytics.track('level_completed', gameId, params)
  };
  window.TelePlayCore ??= {};
  window.TelePlayCore.Analytics = Analytics;
})();
