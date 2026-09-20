(() => {
  const MAX = 300;
  const core = () => window.TelePlayCore || {};
  const id = prefix => `${prefix}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
  const append = (key, entry) => {
    const save = core().SaveManager?.read?.() || {};
    const history = Array.isArray(save[key]) ? save[key] : [];
    return core().SaveManager?.write?.({ ...save, [key]: [...history, entry].slice(-MAX) }) || save;
  };
  const safe = value => {
    try { return JSON.parse(JSON.stringify(value || {})); } catch (_) { return {}; }
  };
  const AdminLog = {
    recordEvent(event, gameId = null, params = {}) {
      const entry = { id: id('event'), playerId: window.TelePlayCore?.TelegramAuth?.identity?.().telegramId || null, event: String(event || 'unknown'), gameId: gameId || null, metadata: safe(params), params: safe(params), timestamp: Date.now(), createdAt: Date.now() };
      return window.TelePlayCore?.DataProvider?.recordAnalyticsEvent?.(entry) || append('analyticsEvents', entry);
    },
    recordAction(entry = {}) {
      const action = { id: id('admin'), ...safe(entry), timestamp: entry.timestamp || Date.now() };
      return window.TelePlayCore?.DataProvider?.recordAdminAction?.(action) || append('adminActionLog', action);
    },
    events() { return [...(window.TelePlayCore?.DataProvider?.getAnalyticsEventsSync?.() || core().SaveManager?.read?.().analyticsEvents || [])].reverse(); },
    actions() { return [...(window.TelePlayCore?.DataProvider?.getAdminActionsSync?.() || core().SaveManager?.read?.().adminActionLog || [])].reverse(); }
  };
  window.TelePlayAdmin = window.TelePlayAdmin || {};
  window.TelePlayAdmin.Log = AdminLog;
  window.TelePlayAdminLog = AdminLog;
})();
