/* Penalty Duel: the sports module owns the session, while Sports Engine owns ball math. */
(() => {
  const ID = 'penalty-duel', CFG = () => window.PenaltyDuelConfig, $ = id => document.getElementById(id);
  const tg = () => window.Telegram?.WebApp, shell = () => window.TelePlayGameShell, core = () => window.TelePlayCore;
  let screen, canvas, renderer, physics, keeper, score, startLayer, resultLayer, raf = 0, shotTimer = 0, flightStartedAt = 0, initialized = false, callbacks = {}, soundOn = true;
  let run = null, swipe = null, runToken = 0;
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const newRunToken = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const now = () => (window.performance?.now ? performance.now() : Date.now());
  const haptic = type => { try { if (core()?.HapticManager) { type === 'success' ? core().HapticManager.notification('success') : core().HapticManager.impact(type); } else if (type === 'success') tg()?.HapticFeedback?.notificationOccurred('success'); else tg()?.HapticFeedback?.impactOccurred(type); } catch (_) {} };
  function emit(event, params = {}) { if (core()?.Analytics?.track) { core().Analytics.track(event, ID, params); return; } shell()?.emit?.(event, { gameId: ID, ...params }); }
  const play = name => { try { shell()?.SoundManager?.play(name); } catch (_) {} };
  function toast(text, color = '#fff') { const el = $('penaltyEventToast'); if (!el) return; el.textContent = text; el.style.color = color; el.classList.remove('show'); requestAnimationFrame(() => el.classList.add('show')); clearTimeout(toast.timer); toast.timer = setTimeout(() => el.classList.remove('show'), 820); }
  function point(e) { const r = canvas.getBoundingClientRect(); return { x: clamp(e.clientX - r.left, 0, r.width), y: clamp(e.clientY - r.top, 0, r.height) }; }
  function stats() { return core()?.PlayerData?.game(ID) || shell()?.getStats?.(ID) || {}; }
  function renderMenu() { const s = stats(); $('penaltyMenuBest').textContent = Number(s.bestScore || 0).toLocaleString('ru-RU'); }
  function updateHud() {
    if (!run) return;
    $('penaltyScore').textContent = Math.floor(score.score).toLocaleString('ru-RU');
    $('penaltyShotLabel').textContent = run.training ? `ТРЕНИРОВКА ${run.shotIndex + 1} / ${CFG().seriesLength}` : `УДАР ${run.shotIndex + 1} / ${CFG().seriesLength}`;
    $('penaltyCombo').textContent = `COMBO ×${score.combo}`; $('penaltyCombo').classList.toggle('hot', score.combo > 1);
    $('penaltySeriesProgress').style.width = `${(run.shotIndex / CFG().seriesLength) * 100}%`;
    $('penaltyGoals').textContent = run.goals; $('penaltySaves').textContent = run.saves; $('penaltyRunCoins').textContent = run.coins;
  }
  function draw() {
    if (!renderer) return;
    const aim = swipe?.current ? targetFromSwipe(swipe.current) : null;
    renderer.render({ state: run?.phase || 'ready', ball: physics?.position, keeperDirection: run?.keeperDirection, keeperSaving: run?.keeperSaving, keeperJump: run?.keeperJump || 0, saveFx: run?.phase === 'save_fx', zoneId: run?.zoneId, swipeStart: swipe?.start, swipeCurrent: aim || swipe?.current });
  }
  function ballPoint() { return { x: renderer.width * .5, y: renderer.height * .79 }; }
  function setPhysicsBounds() { physics?.setBounds?.({ minX: 14, maxX: renderer.width - 14, minY: 18, maxY: renderer.height - 18 }); }
  function cancelLoop() { if (raf) cancelAnimationFrame(raf); raf = 0; }
  function loop(t) {
    raf = requestAnimationFrame(loop);
    if (!run || !['flying', 'save_fx'].includes(run.phase)) { draw(); return; }
    const elapsed = ((t - (run.lastFrame || t)) / 1000); const stepped = physics.step(Math.min(.035, elapsed > 0 ? elapsed : 1 / 60)); run.lastFrame = t; draw();
    if (stepped.done || (flightStartedAt && now() - flightStartedAt > (run.phase === 'save_fx' ? 900 : 1900))) { cancelLoop(); run.phase === 'save_fx' ? completeShot() : resolveShot(); }
  }
  function resetRun() {
    cancelLoop(); clearTimeout(shotTimer); run = { shotIndex: 0, goals: 0, saves: 0, score: 0, coins: 0, perfects: 0, maxCombo: 1, phase: 'ready', training: true, keeperDirection: 'center', keeperSaving: false, zoneId: 'center', shots: [], lastFrame: 0 };
    physics.reset(); setPhysicsBounds(); const ball = ballPoint(); physics.position = { x: ball.x, y: ball.y, z: 0 }; score.reset(); swipe = null; updateHud(); draw();
  }
  function targetFromSwipe(end) {
    const r = window.PenaltyDuelGoalSystem.goalRect(renderer.width, renderer.height), x = clamp(end.x, r.x + 5, r.x + r.width - 5), y = clamp(end.y, r.y + 5, r.y + r.height - 5), zone = window.PenaltyDuelGoalSystem.zoneAt(x, y, renderer.width, renderer.height);
    return { x, y, zone };
  }
  function makeShot(start, end) {
    const target = targetFromSwipe(end), dx = end.x - start.x, dy = end.y - start.y, distance = Math.hypot(dx, dy), height = clamp((start.y - end.y) / Math.max(80, renderer.height * .33) + .5, 0, 1), power = clamp(distance / Math.max(130, renderer.width * .48), .18, 1), curve = clamp(dx / Math.max(120, renderer.width * .44), -1, 1) * .65;
    return { start: { x: renderer.width * .5, y: renderer.height * .79 }, target: { x: target.x, y: target.y }, zone: target.zone, zoneId: target.zone.id, direction: { x: dx, y: dy }, power, height, curve, spin: curve, timestamp: Date.now() };
  }
  function onPointerDown(e) { if (!run || run.phase !== 'ready' || run.shotIndex >= CFG().seriesLength) return; e.preventDefault(); const touch = point(e), ball = ballPoint(); if (Math.hypot(touch.x - ball.x, touch.y - ball.y) > 105) return; swipe = { id: e.pointerId, start: ball, current: touch }; canvas.setPointerCapture?.(e.pointerId); draw(); }
  function onPointerMove(e) { if (!swipe || swipe.id !== e.pointerId) return; e.preventDefault(); swipe.current = point(e); draw(); }
  function onPointerUp(e) { if (!swipe || swipe.id !== e.pointerId) return; e.preventDefault(); const current = e.clientX == null ? swipe.current : point(e), start = swipe.start; swipe = null; if (Math.hypot(current.x - start.x, current.y - start.y) < 22) { draw(); return; } takeShot(makeShot(start, current)); }
  function takeShot(shot) {
    if (!run || run.phase !== 'ready') return; run.phase = 'mind'; run.keeperJump = 0; run.keeperSaving = false; run.zoneId = shot.zoneId; run.training = run.shotIndex < CFG().trainingShots; run.currentShot = shot; $('penaltyMind').textContent = run.training ? 'ТРЕНИРОВКА · СМОТРИ НА ЦЕЛЬ' : 'ВРАТАРЬ ЧИТАЕТ УДАР'; $('penaltyMind').classList.add('active');
    const hint = keeper.mindMove({ zone: shot.zone }, run.shotIndex); run.keeperDirection = hint.direction; draw();
    emit('penalty_duel_shot', { shot: { direction: shot.direction, power: shot.power, curve: shot.curve, zone: shot.zoneId }, training: run.training });
    play('place'); haptic('light');
    shotTimer = setTimeout(() => { if (!run || run.phase !== 'mind') return; $('penaltyMind').classList.remove('active'); run.phase = 'flying'; physics.kick(shot); flightStartedAt = now(); run.lastFrame = flightStartedAt; cancelLoop(); raf = requestAnimationFrame(loop); }, 210);
  }
  function completeShot() {
    if (!run || !run.currentShot) return;
    run.score = score.score; physics.position = { ...ballPoint(), z: 0 }; run.currentShot = null; run.shotIndex += 1; run.phase = 'ready'; run.keeperSaving = false; flightStartedAt = 0; updateHud(); draw();
    if (run.shotIndex >= CFG().seriesLength) setTimeout(finish, 520);
  }
  function resolveShot() {
    if (!run || !run.currentShot || run.phase === 'resolving' || run.phase === 'save_fx') return; run.phase = 'resolving'; const shot = run.currentShot, zone = window.PenaltyDuelGoalSystem.get(shot.zoneId, renderer.width, renderer.height);
    const distanceFromCenter = Math.hypot(shot.target.x - zone.center.x, shot.target.y - zone.center.y); const perfect = distanceFromCenter < 4 && shot.power > .73 && shot.height > .28 && shot.height < .92; const outcome = keeper.resolve({ zone, shot, training: false }); run.keeperDirection = outcome.direction; run.keeperJump = 1;
    const training = run.training;
    if (outcome.saved) {
      run.saves += 1; run.keeperSaving = true; run.shots.push({ ...shot, result: 'save', keeper: outcome }); score.awardShot({ goal: false }); emit('penalty_duel_save', { zone: shot.zoneId, direction: outcome.direction, timing: outcome.timing, training }); play('collision'); haptic('heavy'); renderer.effect('#ff70b8', 6); toast(training ? 'ТРЕНИРОВКА · СЕЙВ' : 'SAVE!', '#ff70b8'); run.phase = 'save_fx'; physics.deflect({ x: shot.target.x, y: shot.target.y, direction: outcome.direction }); flightStartedAt = now(); run.lastFrame = flightStartedAt; cancelLoop(); raf = requestAnimationFrame(loop); return;
    } else {
      const info = score.awardShot({ goal: true, perfect, corner: window.PenaltyDuelGoalSystem.isCorner(zone), power: shot.power > .84, multiplier: zone.scoreMultiplier }); run.goals += 1; run.score = score.score; run.maxCombo = Math.max(run.maxCombo, score.maxCombo); run.coins += perfect ? 3 : 1; if (perfect) run.perfects += 1; run.shots.push({ ...shot, result: 'goal', perfect, keeper: outcome }); emit('penalty_duel_goal', { zone: shot.zoneId, points: info.points, keeperDirection: outcome.direction, training }); const goalVisual = window.TelePlayShop?.visualForGame?.(ID, 'goal-effects'); if (perfect) { emit('penalty_duel_perfect', { zone: shot.zoneId, points: info.points }); play('perfect'); haptic('medium'); renderer.effect(goalVisual?.color || '#ffd969', 9); toast('PERFECT SHOT', '#ffd969'); } else { play('coin'); haptic('light'); renderer.effect(goalVisual?.color || '#69f1ff', 3); toast(`${window.PenaltyDuelGoalSystem.isCorner(zone) ? 'CORNER SHOT' : 'GOAL'} +${info.points}`, '#69f1ff'); } }
    completeShot();
  }
  function finish() {
    if (!run || run.phase === 'finished') return; run.phase = 'finished'; cancelLoop(); const previous = stats(), result = window.PenaltyDuelResultSystem.buildResult({ score: run.score, goals: run.goals, saves: run.saves, perfects: run.perfects, maxCombo: run.maxCombo, shots: run.shots.length, coins: run.coins }, previous), reward = Math.max(0, run.goals + run.perfects * 2 + (result.newRecord ? 5 : 0));
    const payload = { bestScore: result.bestScore, bestSeries: result.bestSeries, goals: Number(previous.goals || 0) + run.goals, gamesPlayed: Number(previous.gamesPlayed || 0) + 1, lastResult: { score: result.score, goals: run.goals, saves: run.saves, coins: run.coins, maxCombo: run.maxCombo }, lastScore: result.score };
    core()?.PlayerData?.record(ID, payload);
    core().RewardManager.award(ID, { coins: reward, score: result.score, metadata: { transactionId: `game:${ID}:run:${runToken}`, runToken } });
    emit('penalty_duel_finished', { score: result.score, goals: run.goals, saves: run.saves, reward, bestScore: result.bestScore }); emit('game_finished', { score: result.score, reward, goals: run.goals, saves: run.saves, maxCombo: run.maxCombo, victory: run.goals >= 3 });
    if (result.newRecord) { emit('penalty_duel_record', { score: result.score }); emit('new_record', { score: result.score }); play('record'); haptic('success'); screen.classList.add('penalty-record'); }
    else play('collision');
    const progression = core()?.PlayerData?.progress?.() || { level: 1, totalXP: 0 }; $('penaltyResultLevel').textContent = progression.level; resultLayer.hidden = false; shell()?.ResultScreen?.show(resultLayer, { score: result.score, bestScore: result.bestScore, reward, newRecord: result.newRecord, title: 'Серия<br>окончена', details: { goals: `${run.goals} / ${run.saves}`, maxCombo: `×${run.maxCombo}`, xp: progression.totalXP } });
  }
  function open(options = {}) { callbacks = options; screen.hidden = false; startLayer.hidden = false; resultLayer.hidden = true; screen.classList.remove('penalty-record'); renderMenu(); renderer.resize(); setPhysicsBounds(); resetRun(); emit('game_opened'); try { tg()?.requestFullscreen?.(); tg()?.disableVerticalSwipes?.(); } catch (_) {} }
  function start() { runToken = newRunToken(); startLayer.hidden = true; resultLayer.hidden = true; screen.classList.remove('penalty-record'); resetRun(); run.phase = 'ready'; emit('penalty_duel_started'); emit('game_started'); haptic('light'); }
  function restart() { emit('penalty_duel_restart'); start(); }
  function pause() { if (!run || run.phase !== 'flying') return; run.pausedPhase = run.phase; run.phase = 'paused'; cancelLoop(); emit('game_paused'); }
  function resume() { if (run?.phase !== 'paused') return; run.phase = run.pausedPhase || 'ready'; if (run.phase === 'flying') raf = requestAnimationFrame(loop); }
  function hide() { cancelLoop(); clearTimeout(shotTimer); screen.hidden = true; run = null; try { tg()?.enableVerticalSwipes?.(); tg()?.exitFullscreen?.(); } catch (_) {} }
  function close() { hide(); callbacks.onHome?.(); }
  function init() {
    if (initialized) return; initialized = true; screen = $('penaltyDuelScreen'); canvas = $('penaltyDuelCanvas'); startLayer = $('penaltyStart'); resultLayer = $('penaltyResult'); soundOn = shell()?.SoundManager?.enabled?.() ?? true; $('penaltySound').textContent = soundOn ? '🔊' : '🔇'; renderer = new window.PenaltyDuelRenderer(canvas); physics = new window.PenaltyDuelPhysics(CFG()); keeper = new window.PenaltyDuelKeeperAI('medium'); score = new window.PenaltyDuelScore();
    canvas.addEventListener('pointerdown', onPointerDown, { passive: false }); canvas.addEventListener('pointermove', onPointerMove, { passive: false }); canvas.addEventListener('pointerup', onPointerUp, { passive: false }); canvas.addEventListener('pointercancel', onPointerUp, { passive: false }); $('penaltyStartButton').addEventListener('click', start); $('penaltyReplay').addEventListener('click', restart); $('penaltyClose').addEventListener('click', close); $('penaltyHome').addEventListener('click', close); $('penaltySound').addEventListener('click', () => { soundOn = !shell()?.SoundManager?.enabled?.(); shell()?.SoundManager?.setEnabled?.(soundOn); $('penaltySound').textContent = soundOn ? '🔊' : '🔇'; }); window.addEventListener('resize', () => { if (!screen.hidden) { renderer.resize(); draw(); } }); document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); }); renderMenu();
  }
  window.PenaltyDuelGame = { init, open, close, hide, start, restart, pause, resume, finish, destroy: () => { hide(); canvas?.removeEventListener('pointerdown', onPointerDown); canvas?.removeEventListener('pointermove', onPointerMove); canvas?.removeEventListener('pointerup', onPointerUp); canvas?.removeEventListener('pointercancel', onPointerUp); initialized = false; }, getState: () => ({ ...run, score: score?.score || 0 }) };
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', init) : init();
})();
