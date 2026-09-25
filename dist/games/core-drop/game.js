(() => {
  const ID = 'core-drop';
  const tg = window.Telegram?.WebApp;
  const shell = () => window.TelePlayGameShell;
  const $ = id => document.getElementById(id);
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const rnd = (min, max) => min + Math.random() * (max - min);

  let screen, canvas, ctx, startLayer, resultLayer, raf = 0, last = 0, runToken = '', callbacks = {};
  let state = 'menu', pointer = { x: 0, active: false }, run = null;

  const palette = {
    0: { bg: '#081027', glow: '#65d8ff', accent: '#a680ff', rock: '#293b6f', crystal: '#75e8ff' },
    1: { bg: '#130d2d', glow: '#ff79dc', accent: '#8b7bff', rock: '#573b84', crystal: '#76f6df' },
    2: { bg: '#240c16', glow: '#ff824d', accent: '#ffcf61', rock: '#713329', crystal: '#ffb56b' }
  };

  function stats() { return shell().getStats(ID); }
  function haptic(type) { try { tg?.HapticFeedback?.impactOccurred(type); } catch (_) {} }
  function scoreFormat(value) { return Math.floor(value || 0).toLocaleString('ru-RU'); }
  function toast(text, color) { const el = $('coreDropToast'); if (!el) return; el.textContent = text; el.style.color = color || '#fff'; el.classList.remove('show'); requestAnimationFrame(() => el.classList.add('show')); clearTimeout(toast.timer); toast.timer = setTimeout(() => el.classList.remove('show'), 900); }

  function makeObject(y, lane, type, size = 1) {
    const width = run.width / 5;
    return { y, x: (lane + .5) * width, lane, type, size, radius: type === 'crystal' ? 13 : 26 + size * 4, hit: false, spin: rnd(0, Math.PI * 2) };
  }

  function generateSegment(y, zone) {
    const width = run.width / 5;
    const safe = Math.floor(rnd(0, 5));
    const objects = [];
    for (let lane = 0; lane < 5; lane += 1) {
      if (lane === safe) continue;
      const roll = Math.random();
      objects.push(makeObject(y + rnd(-10, 18), lane, zone >= 2 && roll < .25 ? 'metal' : roll < .44 ? 'crystal' : 'rock', zone >= 2 ? rnd(.8, 1.2) : rnd(.55, 1))); 
    }
    if (Math.random() < .46) objects.push(makeObject(y - 120, Math.floor(rnd(0, 5)), 'crystal', 1));
    if (zone > 0 && Math.random() < .18) objects.push(makeObject(y - 190, Math.floor(rnd(0, 5)), 'lava', 1));
    return objects.map(item => ({ ...item, x: (item.lane + .5) * width }));
  }

  function resetRun() {
    run = { elapsed: 0, depth: 0, score: 0, combo: 1, maxCombo: 1, coins: 0, mass: 1, charge: 100, stability: 100, width: canvas.clientWidth || 360, height: canvas.clientHeight || 680, coreX: (canvas.clientWidth || 360) / 2, coreY: (canvas.clientHeight || 680) * .28, speed: 160, zone: 0, zoneProgress: 0, objects: [], sparks: [], shake: 0, impulse: 0, nextSpawn: 0, collected: 0, hits: 0 };
    for (let i = 0; i < 12; i += 1) run.objects.push(...generateSegment(-80 - i * 150, i > 6 ? 1 : 0));
    resize();
  }

  function resize() { if (!canvas) return; const ratio = Math.min(2, window.devicePixelRatio || 1); const rect = canvas.getBoundingClientRect(); canvas.width = Math.round(rect.width * ratio); canvas.height = Math.round(rect.height * ratio); ctx.setTransform(ratio, 0, 0, ratio, 0, 0); if (run) { run.width = rect.width; run.height = rect.height; } }

  function addSparks(x, y, color, amount = 10) { for (let i = 0; i < amount; i += 1) run.sparks.push({ x, y, vx: rnd(-90, 90), vy: rnd(-120, 30), life: rnd(.35, .8), max: .8, color }); }
  function updateHud() {
    if (!run) return;
    $('coreDropDepth').textContent = `${scoreFormat(run.depth)} м`;
    $('coreDropScore').textContent = scoreFormat(run.score);
    $('coreDropMass').textContent = scoreFormat(run.mass);
    $('coreDropCombo').textContent = `×${run.combo}`;
    $('coreDropStabilityBar').style.width = `${run.stability}%`;
    $('coreDropChargeBar').style.width = `${run.charge}%`;
    $('coreDropStabilityText').textContent = `${Math.ceil(run.stability)}%`;
    $('coreDropChargeText').textContent = `${Math.ceil(run.charge)}%`;
    $('coreDropZone').textContent = ['ВЕРХНЯЯ КОРА', 'КРИСТАЛЛИЧЕСКИЕ ШАХТЫ', 'МАГМАТИЧЕСКИЙ ПОЯС'][run.zone] || 'ГЛУБИНА';
    $('coreDropImpulse').disabled = run.charge < 30 || state !== 'playing';
    $('coreDropImpulse').classList.toggle('is-ready', run.charge >= 30);
  }

  function drawBackground() {
    const p = palette[run.zone] || palette[0];
    const gradient = ctx.createLinearGradient(0, 0, 0, run.height); gradient.addColorStop(0, p.bg); gradient.addColorStop(1, '#050610'); ctx.fillStyle = gradient; ctx.fillRect(0, 0, run.width, run.height);
    ctx.globalAlpha = .2;
    for (let i = 0; i < 18; i += 1) { const x = (i * 73 + run.depth * .2) % run.width; const y = (i * 97 + run.depth * .48) % run.height; ctx.fillStyle = p.glow; ctx.beginPath(); ctx.arc(x, y, 1.2 + (i % 3), 0, Math.PI * 2); ctx.fill(); }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = `${p.accent}18`; ctx.lineWidth = 1;
    for (let lane = 1; lane < 5; lane += 1) { const x = lane * run.width / 5; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, run.height); ctx.stroke(); }
  }

  function drawObject(obj, offset) {
    const p = palette[run.zone] || palette[0], x = obj.x, y = obj.y + offset;
    if (y < -80 || y > run.height + 80) return;
    ctx.save(); ctx.translate(x, y); ctx.rotate(obj.spin + run.elapsed * (obj.type === 'crystal' ? 1.8 : .1));
    if (obj.type === 'crystal') { ctx.shadowBlur = 18; ctx.shadowColor = p.crystal; ctx.fillStyle = p.crystal; ctx.beginPath(); ctx.moveTo(0, -18); ctx.lineTo(12, 0); ctx.lineTo(0, 20); ctx.lineTo(-12, 0); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#fff'; ctx.globalAlpha = .7; ctx.fillRect(-2, -9, 4, 12); }
    else if (obj.type === 'lava') { ctx.shadowBlur = 24; ctx.shadowColor = '#ff573d'; ctx.fillStyle = '#ff613c'; ctx.beginPath(); ctx.arc(0, 0, 32, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#ffcf61'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, 23, 0, Math.PI * 1.4); ctx.stroke(); }
    else { ctx.fillStyle = obj.type === 'metal' ? '#7890a9' : p.rock; ctx.shadowBlur = obj.type === 'metal' ? 12 : 0; ctx.shadowColor = '#b8e6ff'; ctx.beginPath(); for (let i = 0; i < 8; i += 1) { const a = i * Math.PI / 4; const r = obj.radius * (i % 2 ? .83 : 1); ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); ctx.fill(); ctx.strokeStyle = obj.type === 'metal' ? '#c5ecff' : `${p.accent}aa`; ctx.lineWidth = 2; ctx.stroke(); if (obj.type === 'metal') { ctx.strokeStyle = '#d8f5ff66'; ctx.beginPath(); ctx.moveTo(-15, -14); ctx.lineTo(15, 14); ctx.moveTo(15, -14); ctx.lineTo(-15, 14); ctx.stroke(); } }
    ctx.restore();
  }

  function drawCore() {
    const p = palette[run.zone] || palette[0], x = run.width / 2 + (pointer.active ? (pointer.x - run.width / 2) * .12 : 0), y = run.height * .28;
    run.coreX = clamp(x, 38, run.width - 38); run.coreY = y;
    ctx.save(); ctx.translate(run.coreX, y); const pulse = 1 + Math.sin(run.elapsed * 5) * .05; ctx.scale(1, pulse); ctx.shadowBlur = 34; ctx.shadowColor = p.glow; ctx.fillStyle = '#060914'; ctx.beginPath(); ctx.arc(0, 0, 30 + run.mass * .35, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = p.glow; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(0, 0, 34 + run.mass * .35, 0, Math.PI * 2); ctx.stroke(); ctx.strokeStyle = p.accent; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(0, 0, 49 + run.mass * .55, 14, -.25, 0, Math.PI * 2); ctx.stroke(); ctx.fillStyle = '#fff'; ctx.globalAlpha = .92; ctx.beginPath(); ctx.arc(-8, -9, 5, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }

  function render() { if (!run) return; drawBackground(); const offset = run.height * .28 - (run.objects[0]?.y || 0); run.objects.forEach(obj => drawObject(obj, offset)); run.sparks.forEach(s => { ctx.globalAlpha = clamp(s.life / s.max, 0, 1); ctx.fillStyle = s.color; ctx.beginPath(); ctx.arc(s.x, s.y + offset, 2.5, 0, Math.PI * 2); ctx.fill(); }); ctx.globalAlpha = 1; drawCore(); if (run.shake > 0) { /* visual shake is handled by CSS class */ } }

  function useImpulse() { if (state !== 'playing' || run.charge < 30) return; run.charge -= 30; run.impulse = .42; run.score += 55 * run.combo; run.combo = clamp(run.combo + 1, 1, 5); run.maxCombo = Math.max(run.maxCombo, run.combo); addSparks(run.coreX || run.width / 2, run.coreY || run.height * .28, '#fff', 22); shell().SoundManager.play('turbo'); haptic('medium'); toast('ИМПУЛЬС', palette[run.zone].glow); updateHud(); }

  function hitObject(obj) {
    if (obj.hit) return; obj.hit = true; const p = palette[run.zone];
    if (obj.type === 'crystal') { run.charge = clamp(run.charge + 18, 0, 100); run.mass += 1; run.score += 42 * run.combo; run.coins += 1; run.collected += 1; run.combo = clamp(run.combo + 1, 1, 5); run.maxCombo = Math.max(run.maxCombo, run.combo); addSparks(run.coreX, run.coreY, p.crystal, 14); shell().SoundManager.play('coin'); haptic('light'); toast(`+${run.combo > 1 ? 'ЭНЕРГИЯ' : 'КРИСТАЛЛ'}`, p.crystal); shell().emit('core_drop_collect_energy', { gameId: ID, depth: Math.floor(run.depth), combo: run.combo }); }
    else if (obj.type === 'lava') { run.stability = clamp(run.stability - 20, 0, 100); run.combo = 1; run.hits += 1; run.shake = .3; addSparks(run.coreX, run.coreY, '#ff5b45', 18); shell().SoundManager.play('collision'); haptic('heavy'); toast('ПЕРЕГРЕВ', '#ff8b63'); }
    else if (obj.type === 'metal') { if (run.impulse > 0 || run.mass >= 10) { run.mass += 2; run.score += 80 * run.combo; run.combo = clamp(run.combo + 1, 1, 5); addSparks(run.coreX, run.coreY, '#d7f4ff', 20); shell().SoundManager.play('clear'); haptic('medium'); toast('ПРОБИТО', '#d7f4ff'); } else { run.stability = clamp(run.stability - 27, 0, 100); run.combo = 1; run.hits += 1; run.shake = .35; addSparks(run.coreX, run.coreY, '#ff6e82', 22); shell().SoundManager.play('collision'); haptic('heavy'); toast('УДАР', '#ff7188'); } }
    if (run.stability <= 0) finish(false);
  }

  function update(dt) {
    run.elapsed += dt; run.speed = Math.min(355, 160 + run.depth * .055); if (run.impulse > 0) { run.impulse -= dt; run.speed += 310; }
    run.depth += run.speed * dt * .08; run.score += run.speed * dt * .065 * run.combo; run.zoneProgress += run.speed * dt * .05;
    const nextZone = run.depth > 1800 ? 2 : run.depth > 720 ? 1 : 0; if (nextZone !== run.zone) { run.zone = nextZone; shell().SoundManager.play('levelComplete'); haptic('success'); toast(['ВЕРХНЯЯ КОРА', 'КРИСТАЛЛИЧЕСКИЕ ШАХТЫ', 'МАГМАТИЧЕСКИЙ ПОЯС'][run.zone], palette[run.zone].glow); shell().emit('core_drop_zone_reached', { gameId: ID, zone: run.zone + 1, depth: Math.floor(run.depth) }); }
    const targetX = pointer.active ? pointer.x : run.width / 2; run.coreX += (clamp(targetX, 34, run.width - 34) - run.coreX) * Math.min(1, dt * 8);
    const offset = run.height * .28 - (run.objects[0]?.y || 0); run.objects.forEach(obj => { obj.y += run.speed * dt; const screenY = obj.y + offset; if (!obj.hit && Math.abs(screenY - run.coreY) < obj.radius + 35 && Math.abs(obj.x - run.coreX) < obj.radius + 32) hitObject(obj); });
    run.objects = run.objects.filter(obj => obj.y + offset < run.height + 140 && !obj.hit);
    while (run.objects.length < 18) { const lastY = run.objects.reduce((lowest, item) => Math.min(lowest, item.y), 0); run.objects.push(...generateSegment(lastY - rnd(120, 230), run.zone)); }
    run.sparks.forEach(s => { s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 180 * dt; s.life -= dt; }); run.sparks = run.sparks.filter(s => s.life > 0); run.shake = Math.max(0, run.shake - dt); updateHud();
  }

  function frame(now) { if (state !== 'playing') return; const dt = Math.min(.034, (now - last) / 1000 || .016); last = now; update(dt); render(); raf = requestAnimationFrame(frame); }
  function start() { runToken = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; state = 'playing'; startLayer.hidden = true; resultLayer.hidden = true; screen.classList.remove('core-drop-death', 'core-drop-record'); resetRun(); shell().emit('core_drop_started', { gameId: ID }); shell().emit('game_started', { gameId: ID }); haptic('light'); last = performance.now(); cancelAnimationFrame(raf); raf = requestAnimationFrame(frame); }
  function finish(completed = false) { if (state !== 'playing') return; state = 'result'; cancelAnimationFrame(raf); const previous = stats(); const score = Math.floor(run.score); const reward = Math.max(2, Math.floor(run.coins + run.depth / 220)); const result = shell().saveResult(ID, score, { bestDepth: Math.max(previous.bestDepth || 0, Math.floor(run.depth)), bestCombo: Math.max(previous.bestCombo || 1, run.maxCombo), lastResult: { score, depth: Math.floor(run.depth), mass: run.mass, combo: run.maxCombo } }); window.TelePlayCore?.RewardManager?.award(ID, { coins: reward, score, metadata: { transactionId: `game:${ID}:run:${runToken}`, runToken, depth: Math.floor(run.depth) } }); shell().emit('core_drop_game_over', { gameId: ID, score, depth: Math.floor(run.depth), mass: run.mass, maxCombo: run.maxCombo, reward }); shell().emit('game_finished', { gameId: ID, score, reward, depth: Math.floor(run.depth), maxCombo: run.maxCombo, playTime: Math.floor(run.elapsed) }); if (result.newRecord) { screen.classList.add('core-drop-record'); shell().emit('core_drop_new_record', { gameId: ID, score, depth: Math.floor(run.depth) }); shell().emit('new_record', { gameId: ID, score }); shell().SoundManager.play('record'); haptic('success'); } else { screen.classList.add('core-drop-death'); shell().SoundManager.play('death'); haptic('heavy'); } shell().ResultScreen.show(resultLayer, { score, bestScore: result.bestScore, reward, newRecord: result.newRecord, title: result.newRecord ? 'Новый<br>рубеж!' : 'Ядро<br>разрушено', details: { depth: `${scoreFormat(run.depth)} м`, mass: scoreFormat(run.mass), maxCombo: `×${run.maxCombo}`, shards: scoreFormat(run.coins) } }); }
  function pause() { if (state === 'playing') { state = 'paused'; cancelAnimationFrame(raf); $('coreDropPause').textContent = '▶'; toast('ПАУЗА', '#c9d4ff'); } else if (state === 'paused') { state = 'playing'; $('coreDropPause').textContent = 'Ⅱ'; last = performance.now(); raf = requestAnimationFrame(frame); } }
  function open(options = {}) { callbacks = options; screen.hidden = false; startLayer.hidden = false; resultLayer.hidden = true; state = 'menu'; const best = stats(); $('coreDropMenuBest').textContent = scoreFormat(best.bestScore); $('coreDropMenuDepth').textContent = `${scoreFormat(best.bestDepth)} м`; resize(); try { tg?.requestFullscreen(); tg?.disableVerticalSwipes(); } catch (_) {} }
  function close() { cancelAnimationFrame(raf); state = 'menu'; screen.hidden = true; try { tg?.enableVerticalSwipes(); tg?.exitFullscreen(); } catch (_) {} callbacks.onHome?.(); }
  function bind() {
    screen = $('coreDropScreen'); canvas = $('coreDropCanvas'); ctx = canvas.getContext('2d'); startLayer = $('coreDropStart'); resultLayer = $('coreDropResult');
    $('coreDropStartButton').addEventListener('click', start); $('coreDropReplay').addEventListener('click', start); $('coreDropHome').addEventListener('click', close); $('coreDropClose').addEventListener('click', close); $('coreDropPause').addEventListener('click', pause); $('coreDropImpulse').addEventListener('click', useImpulse);
    canvas.addEventListener('pointermove', event => { const rect = canvas.getBoundingClientRect(); pointer.x = event.clientX - rect.left; pointer.active = true; }); canvas.addEventListener('pointerdown', event => { canvas.setPointerCapture?.(event.pointerId); const rect = canvas.getBoundingClientRect(); pointer.x = event.clientX - rect.left; pointer.active = true; }); canvas.addEventListener('pointerup', () => { pointer.active = false; }); canvas.addEventListener('pointercancel', () => { pointer.active = false; });
    window.addEventListener('resize', resize); document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'playing') pause(); }); resize();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind); else bind();
  window.CoreDropGame = { init: bind, open, close, start, pause, resume: pause, restart: start, hide: close };
})();
