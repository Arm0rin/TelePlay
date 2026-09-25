(() => {
  const sessions = new Map(), active = new Set(), productSessions = new Map(), core = () => window.TelePlayCore;
  const sessionId = gameId => `session:${gameId}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
  function lifecycle(event, gameId) {
    if (!gameId || (event !== 'game_started' && event !== 'game_finished')) return null;
    if (event === 'game_started') {
      const existing = productSessions.get(gameId);
      if (existing) return existing;
      const next = { id: sessionId(gameId), startedAt: Date.now(), startPromise: Promise.resolve(null) };
      productSessions.set(gameId, next);
      return next;
    }
    const current = productSessions.get(gameId) || { id: sessionId(gameId), startedAt: Date.now(), startPromise: Promise.resolve(null) };
    productSessions.delete(gameId);
    return current;
  }
  function recordRemoteSession(event, gameId, params = {}, session = null) {
    if (!core()?.DataProvider?.isBackendEnabled?.() || !gameId) return;
    if (event === 'game_started') {
      if (!session) return;
      session.startPromise = Promise.resolve(core().DataProvider.recordGameSession?.({ id: session.id, gameId, startedAt: session.startedAt, result: { event: 'started' } }));
    } else if (event === 'game_finished') {
      if (!session) return;
      const finishedAt = Date.now(), duration = Math.max(0, finishedAt - session.startedAt), entry = { id: session.id, gameId, startedAt: session.startedAt, finishedAt, duration, score: Number(params.score || 0), result: params };
      Promise.resolve(session.startPromise).then(started => {
        if (!started) return null;
        return core().DataProvider.recordGameSession?.(entry);
      }).then(saved => {
        if (!saved) return null;
        return core().DataProvider.submitGameResult?.({ gameId, sessionId: session.id, score: entry.score, duration: entry.duration, timestamp: finishedAt, metadata: params });
      }).catch(() => {});
    }
  }
  function handleEvent(event, gameId, params = {}) {
    if (event === 'game_started' && gameId) active.add(gameId);
    if (event === 'game_finished' && gameId) active.delete(gameId);
    const session = lifecycle(event, gameId);
    const detail = session ? { ...params, gameSessionId: session.id, gameSessionStartedAt: session.startedAt, ...(event === 'game_finished' ? { durationMs: Math.max(0, Date.now() - session.startedAt) } : {}) } : params;
    recordRemoteSession(event, gameId, detail, session);
    core()?.PlayerData?.handleEvent?.(event, gameId, detail);
    window.TelePlayAdminLog?.recordEvent?.(event, gameId, detail);
    const payload = { event, at: Date.now(), gameId, ...detail };
    window.dispatchEvent(new CustomEvent(`teleplay:${event}`, { detail: payload }));
    window.dataLayer?.push(payload);
    return payload;
  }
  const GameSession = {
    register(gameId, adapter) { sessions.set(gameId, adapter); return adapter; },
    get(gameId) { return sessions.get(gameId); },
    isActive(gameId) { return active.has(gameId); },
    handleEvent,
    startGame(gameId, options) { const adapter = sessions.get(gameId); if (!adapter) throw new Error(`No adapter registered for ${gameId}`); active.delete(gameId); core().Analytics.gameOpened(gameId); adapter.start?.(options); if (!active.has(gameId)) core().Analytics.gameStarted(gameId); return adapter; },
    // Games still calculate their local score immediately. In backend mode the
    // result is submitted asynchronously and only a server Reward Proof can
    // settle currency/XP; the UI is never blocked by this request.
    finishGame(gameId, result = {}) { const adapter = sessions.get(gameId); adapter?.finish?.(result); if (active.has(gameId)) core().Analytics.gameFinished(gameId, { score: result.score || 0, ...result }); return result; },
    restartGame(gameId) { const adapter = sessions.get(gameId); core().Analytics.gameRestarted(gameId); adapter?.restart?.(); },
    pauseGame(gameId) { const adapter = sessions.get(gameId); core().Analytics.gamePaused(gameId); adapter?.pause?.(); },
    resumeGame(gameId) { sessions.get(gameId)?.resume?.(); },
    destroyGame(gameId) { sessions.get(gameId)?.destroy?.(); sessions.delete(gameId); active.delete(gameId); productSessions.delete(gameId); }
  };
  window.TelePlayCore ??= {}; window.TelePlayCore.GameSession = GameSession;
})();
