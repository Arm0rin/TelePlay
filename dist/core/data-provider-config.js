(() => {
  const runtime = window.__TELEPLAY_CONFIG__ || {};
  const requestedMode = String(runtime.DATA_MODE || 'local').toLowerCase();
  const backendUrl = String(runtime.API_URL || '').trim().replace(/\/$/, '');
  const mode = requestedMode === 'backend' ? 'backend' : 'local';
  window.TelePlayDataConfig = Object.freeze({
    mode,
    environment: mode === 'backend' ? 'production' : 'development',
    backendUrl,
    allowLocalFallback: runtime.ALLOW_LOCAL_FALLBACK !== false,
    requestTimeoutMs: Math.max(1500, Number(runtime.API_TIMEOUT_MS || 8000)),
    healthTimeoutMs: Math.max(1000, Number(runtime.HEALTH_TIMEOUT_MS || 4000)),
    endpoints: Object.freeze({
      health: '/health',
      me: '/players/me',
      meImport: '/players/me/import',
      meState: '/players/me/state',
      players: '/players',
      transactions: '/transactions',
      gameSessions: '/game-sessions',
      gameResults: '/games/result',
      rewardProofs: '/reward-proofs',
      gameResultsAdmin: '/game-results',
      fraudEvents: '/fraud-events',
      analytics: '/analytics/events',
      adminActions: '/admin/actions',
      paymentPackages: '/payments/packages',
      paymentInvoice: '/payments/invoice',
      payments: '/payments',
      myPayments: '/payments/me'
    }),
    syncDebounceMs: 350
  });
})();
