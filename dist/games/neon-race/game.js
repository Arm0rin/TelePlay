(() => {
  const tg = window.Telegram?.WebApp;
  tg?.ready();
  tg?.expand();
  try { tg?.setHeaderColor('#080b17'); tg?.setBackgroundColor('#080b17'); } catch (_) {}

  const $ = (id) => document.getElementById(id);
  const storeView = $('storeView');
  const gameScreen = $('gameScreen');
  const canvas = $('raceCanvas');
  const renderer = new window.NeonRaceRenderer(canvas);
  const ctx = renderer.ctx;
  const startPanel = $('startPanel');
  const resultPanel = $('resultPanel');
  const touchControls = document.querySelector('.touch-controls');
  const {CARS,VEHICLES,RACE_RULES,BOOSTERS}=window.NeonRaceConfig;
  window.TelePlayRaceRules=RACE_RULES;
  const storage=window.NeonRaceGarage.create(CARS);
  const legacyRaceStats = window.TelePlayGameShell.getStats('neon-race');
  if (storage.best > legacyRaceStats.bestScore) window.TelePlayGameShell.mergeStats('neon-race',{bestScore:storage.best});

  const activeCar = () => CARS[storage.selectedCar];
  const activeVehicle = () => VEHICLES.find(vehicle => vehicle.legacyCarId === storage.selectedCar) || VEHICLES[0];
  const hex = (value, alpha = 1) => { const raw = String(value || '').replace('#', ''); if (raw.length !== 6) return value || '#00e7ff'; const n = parseInt(raw, 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${alpha})`; };
  const gameVisual = (slot, fallback = {}) => window.TelePlayShop?.visualForGame?.('neon-race', slot) || fallback;
  const cosmeticVisual = () => gameVisual('cars', { color: activeCar().color, accent: activeCar().accent });
  const carAtlas = new Image();
  const spriteBounds = [];
  const carIndex = { spark: 0, volt: 1, phantom: 2 };
  carAtlas.onload = () => {
    const scratch = document.createElement('canvas');
    scratch.width = carAtlas.naturalWidth; scratch.height = carAtlas.naturalHeight;
    const c = scratch.getContext('2d'); c.drawImage(carAtlas, 0, 0);
    const pixels = c.getImageData(0, 0, scratch.width, scratch.height).data;
    const cw = scratch.width / 3, ch = scratch.height / 2;
    for (let i = 0; i < 6; i++) {
      const ox = Math.round(i % 3 * cw), oy = Math.round(Math.floor(i / 3) * ch);
      let left = ox + cw, top = oy + ch, right = ox, bottom = oy;
      for (let y = oy; y < oy + ch; y++) for (let x = ox; x < ox + cw; x++) {
        if (pixels[(y * scratch.width + x) * 4 + 3] > 100) {
          left = Math.min(left, x); right = Math.max(right, x);
          top = Math.min(top, y); bottom = Math.max(bottom, y);
        }
      }
      spriteBounds.push([left, top, Math.max(1, right-left+1), Math.max(1, bottom-top+1)]);
    }
    updateStoredUI();
    if (!$('garageScreen').hidden) renderGarage();
  };
  carAtlas.src = './cars-v4.png';

  function paintSprite(c, index, x, y, width, height, glow = null, tint = null) {
    const box = spriteBounds[index];
    if (!box) return false;
    c.save();
    if (glow) { c.shadowColor = glow; c.shadowBlur = index === 2 ? 18 : 10; }
    const dx = x-width/2, dy = y-height/2;
    c.drawImage(carAtlas, ...box, dx, dy, width, height);
    if (tint) { c.globalCompositeOperation = 'source-atop'; c.fillStyle = hex(tint, .34); c.fillRect(dx, dy, width, height); }
    c.restore(); return true;
  }

  function paintThumbnail(element, index) {
    if (!element || !spriteBounds[index]) return;
    let preview = element.querySelector('canvas');
    if (!preview) { element.textContent = ''; preview = document.createElement('canvas'); element.appendChild(preview); }
    preview.width = 160; preview.height = 260;
    paintSprite(preview.getContext('2d'), index, 80, 130, 112, 212);
    element.classList.add('sprite-ready');
  }

  let state = 'menu';
  let score = 0;
  let runCoins = 0;
  let speed = 5.2;
  let nitro = 0;
  let nitroTime = 0;
  let shield = false;
  let combo = 1;
  let maxCombo = 1;
  let toastTimer = 0;
  let lane = 1;
  let playerX = 0;
  let roadOffset = 0;
  let lastTime = 0;
  let spawnTimer = 0;
  let coinTimer = 0;
  let powerTimer = 0;
  let raceTime = 0;
  let runToken = 0;
  const newRunToken = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  let safeTimer = 0;
  let raceDistance = 0;
  let nearMisses = 0;
  let turboUses = 0;
  let obstacles = [];
  let coins = [];
  let powerups = [];
  let sparks = [];
  let callouts = [];
  let swipeStart = null;

  function updateStoredUI() {
    const raceBest = Math.max(storage.best, window.TelePlayGameShell?.getStats('neon-race').bestScore || 0);
    $('walletCoins').textContent = storage.coins;
    if ($('bestScore')) $('bestScore').textContent = raceBest;
    $('panelBest').textContent = raceBest;
    $('garageCoins').textContent = storage.coins;
    $('activeCarName').textContent = activeCar().name;
    const heroCar = document.querySelector('.player-car');
    if (heroCar) { heroCar.style.background = `linear-gradient(${activeCar().color}, ${activeCar().accent})`; heroCar.style.color = activeCar().color; }
    paintThumbnail(heroCar, carIndex[storage.selectedCar]);
    paintThumbnail(document.querySelector('.rival-car'), 3);
    paintThumbnail(document.querySelector('.car-icon'), carIndex[storage.selectedCar]);
    renderVehicleProgress($('vehicleProgress'));
  }

  function renderVehicleProgress(target) {
    if(!target)return;
    const next=Object.values(CARS).find(car=>!storage.ownedCars.includes(car.id));
    if(!next){target.innerHTML='<b>Все машины уже открыты</b><small>Гараж полностью собран</small>';return;}
    const current=Math.min(storage.coins,next.price), percent=Math.min(100,current/Math.max(1,next.price)*100);
    target.innerHTML=`<span><b>Следующая машина: ${next.name}</b><small>${current} / ${next.price} 🪙</small></span><i><em style="width:${percent}%"></em></i>`;
  }

  function resize() { renderer.resize(); playerX = laneX(lane); }

  const W = () => innerWidth;
  const H = () => innerHeight;
  const roadWidth = () => Math.min(W() * .88, 520);
  const roadLeft = () => (W() - roadWidth()) / 2;
  const laneWidth = () => roadWidth() / 3;
  const laneX = (n) => roadLeft() + laneWidth() * (n + .5);

  function roundRect(x, y, w, h, r, fill) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.fillStyle = fill;
    ctx.fill();
  }

  function drawBackground() {
    const background = gameVisual('backgrounds', { color: '#111942', accent: '#5d6bff' });
    const grad = ctx.createLinearGradient(0, 0, 0, H());
    grad.addColorStop(0, hex(background.accent || background.color, .34));
    grad.addColorStop(.5, hex(background.color, .16));
    grad.addColorStop(1, '#040611');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W(), H());
    for (let i = 0; i < 18; i++) {
      const x = (i * 83 + roadOffset * .2) % W();
      const y = 100 + (i * 97 % Math.max(160, H() - 160));
      ctx.fillStyle = i % 2 ? hex(background.accent || '#784cff', .14) : hex(background.color || '#00dcff', .15);
      ctx.fillRect(x, y, 2, 18);
    }
    const l = roadLeft();
    ctx.fillStyle = '#111522';
    ctx.fillRect(l, 0, roadWidth(), H());
    const asphalt = ctx.createLinearGradient(l, 0, l + roadWidth(), 0);
    asphalt.addColorStop(0, '#050810'); asphalt.addColorStop(.5, '#222839'); asphalt.addColorStop(1, '#050810');
    ctx.fillStyle = asphalt; ctx.fillRect(l, 0, roadWidth(), H());
    ctx.fillStyle = '#ffffff06';
    for (let y = roadOffset * 3 - 200; y < H(); y += 110) ctx.fillRect(l + 10, y, roadWidth()-20, 1);
    const edge = ctx.createLinearGradient(l, 0, l + 18, 0);
    edge.addColorStop(0, '#00e7ff'); edge.addColorStop(1, '#00e7ff00');
    ctx.fillStyle = edge; ctx.fillRect(l, 0, 18, H());
    const edgeR = ctx.createLinearGradient(l + roadWidth() - 18, 0, l + roadWidth(), 0);
    edgeR.addColorStop(0, '#ff3fa400'); edgeR.addColorStop(1, '#ff3fa4');
    ctx.fillStyle = edgeR; ctx.fillRect(l + roadWidth() - 18, 0, 18, H());
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#dce5ff48';
    ctx.setLineDash([34, 34]);
    ctx.lineDashOffset = roadOffset;
    for (let i = 1; i < 3; i++) {
      ctx.beginPath(); ctx.moveTo(l + laneWidth() * i, 0); ctx.lineTo(l + laneWidth() * i, H()); ctx.stroke();
    }
    ctx.setLineDash([]);
    if(state==='playing'&&speed>8){
      const intensity=Math.min(1,(speed-8)/5);
      ctx.save();ctx.globalAlpha=.12+intensity*.18;ctx.strokeStyle=nitroTime>0?'#bffcff':'#777cff';ctx.lineWidth=1+intensity*2;
      for(let i=0;i<10;i++){const x=(i*67+roadOffset*2)%W(), y=(i*113+roadOffset*9)%H();ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x,y+25+speed*4);ctx.stroke()}
      ctx.restore();
    }
  }

  function drawCar(x, y, color, isPlayer = false) {
    const visual = isPlayer ? cosmeticVisual() : null;
    const trailVisual = isPlayer ? gameVisual('trails', null) : null;
    const effectVisual = isPlayer ? gameVisual('effects', null) : null;
    const index = isPlayer ? carIndex[storage.selectedCar] : 3 + ['#8a98a8', '#4d647b', '#9f7764'].indexOf(color);
    if (spriteBounds.length === 6) {
      ctx.save(); ctx.translate(x, y);
      if (isPlayer) ctx.rotate(Math.max(-.12, Math.min(.12, (laneX(lane)-playerX) / 400)));
      if (isPlayer && state === 'playing') {
        const length = nitroTime > 0 ? 84 : (trailVisual ? 43 : 26);
        const trail = ctx.createLinearGradient(0, 35, 0, 45+length);
        trail.addColorStop(0, nitroTime > 0 ? '#eaffff' : (trailVisual?.color || visual.color));
        trail.addColorStop(.45, hex(trailVisual?.accent || visual.accent || visual.color, .82));
        trail.addColorStop(1, '#00000000');
        ctx.fillStyle = trail;
        for (const side of [-1, 1]) {
          ctx.beginPath(); ctx.moveTo(side*13-4, 34); ctx.lineTo(side*13+4, 34);
          ctx.lineTo(side*13, 45+length); ctx.fill();
        }
      }
      if (!isPlayer) paintSprite(ctx, Math.max(3, index), 0, 0, 46, 78);
      if (isPlayer) paintSprite(ctx, index, 0, 0, 50, 84, effectVisual?.color || visual.accent || visual.color, visual.color);
      if (isPlayer && effectVisual) { ctx.globalAlpha = .34; ctx.fillStyle = effectVisual.color || visual.color; ctx.shadowColor = effectVisual.accent || effectVisual.color; ctx.shadowBlur = 20; ctx.beginPath(); ctx.ellipse(0, 32, 20, 9, 0, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore(); return;
    }
    ctx.save();
    ctx.shadowColor = color; ctx.shadowBlur = isPlayer ? 22 : 10;
    roundRect(x - 23, y - 39, 46, 78, 13, color);
    ctx.shadowBlur = 0;
    roundRect(x - 15, y - 25, 30, 27, 8, '#152040');
    roundRect(x - 16, y + 15, 32, 10, 5, isPlayer ? '#c8ffff' : '#ffb3dc');
    ctx.fillStyle = '#090b12';
    ctx.fillRect(x - 27, y - 23, 5, 19); ctx.fillRect(x + 22, y - 23, 5, 19);
    ctx.fillRect(x - 27, y + 14, 5, 19); ctx.fillRect(x + 22, y + 14, 5, 19);
    if (isPlayer) {
      ctx.fillStyle = `${visual?.color || '#00e7ff'}55`;
      ctx.beginPath(); ctx.moveTo(x - 14, y + 39); ctx.lineTo(x, y + 70 + Math.random() * 11); ctx.lineTo(x + 14, y + 39); ctx.fill();
    }
    ctx.restore();
  }

  function drawGaragePreview(canvas, car) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.clientWidth || 118; const h = canvas.clientHeight || 164;
    canvas.width = w * dpr; canvas.height = h * dpr;
    const c = canvas.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (spriteBounds.length === 6) {
      const g = c.createRadialGradient(w/2, h/2, 2, w/2, h/2, h*.7);
      g.addColorStop(0, car.color+'40'); g.addColorStop(1, '#090e1c');
      c.fillStyle = g; c.fillRect(0, 0, w, h);
      c.strokeStyle = car.color+'55'; c.lineWidth = 1;
      c.beginPath(); c.ellipse(w/2, h*.75, w*.4, 15, 0, 0, Math.PI*2); c.stroke();
      paintSprite(c, carIndex[car.id], w/2, h*.52, Math.min(w*.65, 82), Math.min(h*.76, 138), car.color);
      return;
    }
    const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#202852'); g.addColorStop(1, '#080b18'); c.fillStyle = g; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#ffffff25'; c.lineWidth = 2; c.setLineDash([14, 12]); c.beginPath(); c.moveTo(w * .2, 0); c.lineTo(w * .2, h); c.moveTo(w * .8, 0); c.lineTo(w * .8, h); c.stroke(); c.setLineDash([]);
    c.save(); c.shadowColor = car.color; c.shadowBlur = 22; c.fillStyle = car.color; c.beginPath(); c.roundRect(w / 2 - 25, 40, 50, 88, 15); c.fill(); c.shadowBlur = 0;
    c.fillStyle = '#17203e'; c.beginPath(); c.roundRect(w / 2 - 16, 53, 32, 30, 8); c.fill(); c.fillStyle = '#eaffff'; c.beginPath(); c.roundRect(w / 2 - 17, 101, 34, 10, 5); c.fill();
    c.fillStyle = car.accent; c.beginPath(); c.moveTo(w / 2 - 15, 128); c.lineTo(w / 2, 156); c.lineTo(w / 2 + 15, 128); c.fill(); c.restore();
  }

  function renderGarage() {
    const owned = storage.ownedCars;
    const selected = storage.selectedCar;
    $('garageCoins').textContent = storage.coins;
    $('garageGrid').innerHTML = Object.values(CARS).map(car => {
      const isOwned = owned.includes(car.id); const isSelected = selected === car.id;
      const action = isSelected ? 'Выбрано' : isOwned ? 'Выбрать' : `Купить · ${car.price} ●`;
      return `<article class="garage-card ${isSelected ? 'selected' : ''}" style="--car-color:${car.color}">${isSelected ? '<span class="selected-badge">В ЗАЕЗДЕ</span>' : ''}<canvas class="garage-preview" data-car="${car.id}" aria-label="${car.name}"></canvas><div class="garage-copy"><small>${car.label}</small><h3>${car.name}</h3><p>${car.trait}</p><button class="garage-action ${isOwned ? 'owned' : ''}" data-car-action="${car.id}" ${isSelected ? 'disabled' : ''}>${action}</button></div></article>`;
    }).join('');
    document.querySelectorAll('.garage-preview').forEach(canvas => drawGaragePreview(canvas, CARS[canvas.dataset.car]));
    document.querySelectorAll('[data-car-action]').forEach(button => button.addEventListener('click', () => buyOrSelectCar(button.dataset.carAction)));
  }

  function buyOrSelectCar(id) {
    const car = CARS[id]; if (!car) return { ok: false, reason: 'unknown_car' };
    const owned = storage.ownedCars;
    if (!owned.includes(id)) {
      if (storage.coins < car.price) {
        tg?.HapticFeedback?.notificationOccurred('error');
        if (tg?.showAlert) tg.showAlert(`Не хватает монет. Нужно ещё ${car.price - storage.coins}.`);
        else window.alert(`Не хватает монет. Нужно ещё ${car.price - storage.coins}.`);
        return { ok: false, reason: 'not_enough_coins' };
      }
      const payment = window.TelePlayCore.ShopManager?.charge?.('neon-race-garage', car.price, { transactionId: `garage:car:${id}`, itemId: `car:${id}`, carId: id, price: car.price });
      if (!payment?.ok) {
        tg?.HapticFeedback?.notificationOccurred('error');
        if (tg?.showAlert) tg.showAlert('Не удалось списать монеты. Попробуйте ещё раз.');
        return { ok: false, reason: payment?.reason || 'payment_failed' };
      }
      storage.ownedCars = [...owned, id];
      tg?.HapticFeedback?.notificationOccurred('success');
    }
    storage.selectedCar = id; updateStoredUI(); renderGarage();
    return { ok: true, selected: id, coins: storage.coins };
  }

  function openGarage() {
    if (state !== 'menu' || gameScreen.hidden) return;
    gameScreen.hidden = true;
    $('garageScreen').hidden = false;
    renderGarage(); $('closeGarage').focus();
  }
  function closeGarage() {
    $('garageScreen').hidden = true;
    gameScreen.hidden = false;
    updateStoredUI(); resize(); $('gameGarage').focus();
  }

  function spawnObstacle() {
    const occupied = obstacles.filter(o => o.y < 150).map(o => o.lane);
    const choices = [0, 1, 2].filter(v => !occupied.includes(v));
    const chosen = choices[Math.floor(Math.random() * choices.length)] ?? Math.floor(Math.random() * 3);
    const colors = ['#8a98a8', '#4d647b', '#9f7764'];
    obstacles.push({ lane: chosen, x: laneX(chosen), y: -70, color: colors[Math.floor(Math.random() * colors.length)], passed: false });
    const doubleChance = RACE_RULES.difficulty(raceTime).doubleChance;
    if (Math.random() < doubleChance) {
      const secondChoices = choices.filter(v => v !== chosen);
      const second = secondChoices[Math.floor(Math.random() * secondChoices.length)];
      if (second !== undefined) obstacles.push({ lane: second, x: laneX(second), y: -145, color: colors[Math.floor(Math.random() * colors.length)], passed: false });
    }
  }

  function spawnCoin() {
    const chosen = Math.floor(Math.random() * 3);
    coins.push({ lane: chosen, x: laneX(chosen), y: -25, spin: 0 });
  }

  function spawnPowerup() {
    const chosen = Math.floor(Math.random() * 3);
    powerups.push({ type:BOOSTERS.turbo.id, lane: chosen, x: laneX(chosen), y: -35, spin: 0 });
  }

  function showEvent(text, color = '#ffffff') {
    const el = $('eventToast');
    el.textContent = text; el.style.color = color; el.classList.remove('show');
    requestAnimationFrame(() => el.classList.add('show'));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 850);
  }

  function setNitro(value) {
    nitro = Math.max(0, Math.min(100, value));
    const button = $('useNitro');
    button.style.setProperty('--nitro', `${nitro * 3.6}deg`);
    button.disabled = nitro < 25 || state !== 'playing' || nitroTime > 0;
    button.classList.toggle('ready', nitro >= 25 && nitroTime <= 0);
  }

  function addNitro(value) { setNitro(nitro + value * activeCar().nitroGain); }

  function useNitro() {
    if (state !== 'playing' || nitro < 25 || nitroTime > 0) return false;
    nitroTime = 1.7; setNitro(nitro - 25);
    $('useNitro').classList.add('active');
    showEvent('TURBO!', '#8ff7ff');
    tg?.HapticFeedback?.impactOccurred('heavy');
    window.TelePlayGameShell.SoundManager.play('turbo');
    window.TelePlayGameShell.emit('neon_race_turbo_used',{gameId:'neon-race',source:'meter',score:Math.floor(score)}); turboUses++;
    return true;
  }

  function collectTurbo() {
    nitroTime = Math.max(nitroTime, BOOSTERS.turbo.duration); setNitro(Math.min(100,nitro+35)); $('useNitro').classList.add('active');
    showEvent('TURBO ×2', '#8ff7ff'); window.TelePlayGameShell.SoundManager.play('turbo');
    window.TelePlayGameShell.emit('neon_race_turbo_used',{gameId:'neon-race',source:'pickup',score:Math.floor(score)}); turboUses++;
    tg?.HapticFeedback?.impactOccurred('heavy');
  }

  function growCombo() {
    const before=combo; combo=window.TelePlayGameShell.ScoreSystem.nextCombo(combo,5); maxCombo=Math.max(maxCombo,combo);
    $('combo').textContent=`×${combo}`; document.querySelector('.game-hud .combo-stat').classList.toggle('hot',combo>1);
    if(combo>before) { const stat=document.querySelector('.game-hud .combo-stat');stat.classList.remove('combo-pulse');requestAnimationFrame(()=>stat.classList.add('combo-pulse'));window.TelePlayGameShell.SoundManager.play('combo'); }
  }
  function resetCombo() { combo=window.TelePlayGameShell.ScoreSystem.resetCombo(); $('combo').textContent='×1'; document.querySelector('.game-hud .combo-stat').classList.remove('hot','combo-pulse'); }

  function hit(aX, aY, bX, bY, xPad = 36, yPad = 61) {
    return Math.abs(aX - bX) < xPad && Math.abs(aY - bY) < yPad;
  }

  function move(direction) {
    if (state !== 'playing') return false;
    const next = Math.max(0, Math.min(2, lane + direction));
    if (next === lane) return false;
    lane = next;
    tg?.HapticFeedback?.selectionChanged();
    return true;
  }

  function update(dt) {
    if (state !== 'playing') return;
    raceTime += dt; safeTimer += dt; raceDistance += speed * dt * 10;
    const difficulty=RACE_RULES.difficulty(raceTime);
    const baseSpeed = difficulty.speed + activeVehicle().speedBonus;
    if (nitroTime > 0) {
      nitroTime -= dt;
      speed = baseSpeed * 1.65;
      if (nitroTime <= 0) { $('useNitro').classList.remove('active'); setNitro(nitro); }
    } else speed = baseSpeed;
    score += dt * speed * (.95 + combo * .18) * (nitroTime>0?BOOSTERS.turbo.scoreMultiplier:1);
    roadOffset = (roadOffset + dt * speed * 15) % 68;
    playerX += (laneX(lane) - playerX) * Math.min(1, dt * (18+activeVehicle().handlingBonus*20));
    window.TelePlayGameShell.SoundManager.setEngineSpeed(speed);
    if(safeTimer>=10){safeTimer=0;score+=window.TelePlayGameShell.ScoreSystem.award(25,combo);growCombo();showEvent('ЧИСТЫЙ ЗАЕЗД +25','#b8a7ff')}
    spawnTimer -= dt; coinTimer -= dt; powerTimer -= dt;
    if (spawnTimer <= 0) {
      spawnObstacle();
      spawnTimer=difficulty.spawnDelay+Math.random()*.28;
    }
    if (coinTimer <= 0) { spawnCoin(); coinTimer = 1.35 + Math.random() * 1.3; }
    if (powerTimer <= 0) { spawnPowerup(); powerTimer = 10 + Math.random() * 7; }
    const travel = dt * speed * 72;
    obstacles.forEach(o => o.y += travel);
    coins.forEach(c => { c.y += travel; c.spin += dt * 8; });
    powerups.forEach(p => { p.y += travel; p.spin += dt * 4; });
    obstacles = obstacles.filter(o => o.y < H() + 100);
    coins = coins.filter(c => c.y < H() + 50);
    powerups = powerups.filter(p => p.y < H() + 60);
    const py = H() - 145;
    for (const o of obstacles) {
      if (!o.passed && o.y > py + 62) {
        o.passed = true;
        const gap=Math.abs(o.x-playerX);
        const pass=RACE_RULES.pass(gap,laneWidth());
        if (pass) {
          const perfect=pass==='perfect', base=perfect?100:50;
          score+=window.TelePlayGameShell.ScoreSystem.award(base,combo);nearMisses++;growCombo();addNitro(perfect?24:16);
          callouts.push({x:o.x,y:py-45,text:perfect?'PERFECT +100':'NEAR MISS +50',color:perfect?'#ffd75a':'#8ff7ff',life:1});
          showEvent(`${perfect?'PERFECT PASS':'NEAR MISS'} +${base}`,'#ffd75a');
          window.TelePlayGameShell.SoundManager.play(perfect?'perfect':'near');
          window.TelePlayGameShell.emit('neon_race_near_miss',{gameId:'neon-race',perfect,bonus:base,combo,score:Math.floor(score)});
          tg?.HapticFeedback?.impactOccurred('medium');
        }
      }
      if (hit(playerX, py, o.x, o.y)) {
        if (shield || nitroTime > 0) {
          if (shield) { shield = false; $('shieldPill').hidden = true; }
          o.y = H() + 200; resetCombo();
          showEvent(nitroTime > 0 ? 'ПРОРЫВ!' : 'ЩИТ СПАС!', '#8ff7ff');
          tg?.HapticFeedback?.impactOccurred('heavy');
        } else {
          resetCombo(); gameScreen.classList.add('race-crash'); setTimeout(()=>gameScreen.classList.remove('race-crash'),420);
          for(let i=0;i<24;i++)sparks.push({x:playerX,y:py,vx:(Math.random()-.5)*260,vy:(Math.random()-.5)*260,life:1});
          window.TelePlayGameShell.SoundManager.play('collision');tg?.HapticFeedback?.impactOccurred('heavy');finishRace();return;
        }
      }
    }
    coins = coins.filter(c => {
      if (hit(playerX, py, c.x, c.y, 34, 48)) {
        runCoins += 1;
        score += window.TelePlayGameShell.ScoreSystem.award(10,combo); growCombo();
        addNitro(5);
        $('runCoins').textContent = runCoins;
        tg?.HapticFeedback?.impactOccurred('light');
        window.TelePlayGameShell.SoundManager.play('coin');
        window.TelePlayGameShell.emit('neon_race_coins_collected',{gameId:'neon-race',coins:runCoins,score:Math.floor(score)});
        for (let i = 0; i < 8; i++) sparks.push({ x: c.x, y: c.y, vx: (Math.random() - .5) * 120, vy: (Math.random() - .5) * 120, life: 1 });
        return false;
      }
      return true;
    });
    powerups = powerups.filter(p => {
      if (hit(playerX, py, p.x, p.y, 34, 50)) {
        collectTurbo();
        return false;
      }
      return true;
    });
    sparks.forEach(s => { s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt * 2.2; });
    sparks = sparks.filter(s => s.life > 0);
    callouts.forEach(item=>{item.y-=dt*42;item.life-=dt*1.35});callouts=callouts.filter(item=>item.life>0);
    $('score').textContent = Math.floor(score);
  }

  function draw() { renderer.render(() => {
    drawBackground();
    coins.forEach(c => {
      ctx.save(); ctx.translate(c.x, c.y); ctx.scale(.55 + Math.abs(Math.cos(c.spin)) * .45, 1);
      ctx.shadowColor = '#ffd75a'; ctx.shadowBlur = 16; ctx.fillStyle = '#ffd75a';
      ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0; ctx.strokeStyle = '#fff0a0'; ctx.lineWidth = 3; ctx.stroke(); ctx.restore();
    });
    powerups.forEach(p => {
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.spin);
      ctx.shadowColor = '#00e7ff'; ctx.shadowBlur = 22; ctx.strokeStyle = '#8ff7ff'; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.arc(0, 0, 17, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#00e7ff55'; ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.fill();
      ctx.rotate(-p.spin);ctx.fillStyle='#fff';ctx.beginPath();ctx.moveTo(3,-12);ctx.lineTo(-7,2);ctx.lineTo(0,2);ctx.lineTo(-3,13);ctx.lineTo(9,-3);ctx.lineTo(2,-3);ctx.closePath();ctx.fill();ctx.restore();
    });
    obstacles.forEach(o => drawCar(o.x, o.y, o.color));
    sparks.forEach(s => { ctx.globalAlpha = s.life; ctx.fillStyle = '#ffd75a'; ctx.fillRect(s.x, s.y, 4, 4); ctx.globalAlpha = 1; });
    callouts.forEach(item=>{ctx.save();ctx.globalAlpha=item.life;ctx.textAlign='center';ctx.font='900 13px system-ui';ctx.fillStyle=item.color;ctx.shadowColor=item.color;ctx.shadowBlur=10;ctx.fillText(item.text,item.x,item.y);ctx.restore()});
    if (shield) {
      ctx.save(); ctx.strokeStyle = '#8ff7ff'; ctx.lineWidth = 3; ctx.shadowColor = '#00e7ff'; ctx.shadowBlur = 18;
      ctx.beginPath(); ctx.arc(playerX || laneX(lane), H() - 145, 42 + Math.sin(performance.now() / 120) * 3, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    }
    drawCar(playerX || laneX(lane), H() - 145, nitroTime > 0 ? '#c7ffff' : activeCar().color, true);
  });
  }

  function loop(time) {
    const dt = Math.min(.034, (time - lastTime) / 1000 || 0);
    lastTime = time;
    update(dt); if(!gameScreen.hidden) draw();
    requestAnimationFrame(loop);
  }

  function startRace() {
    runToken = newRunToken(); score = 0; runCoins = 0; speed = 5.2; lane = 1; playerX = laneX(lane);
    nitro = 0; nitroTime = 0; shield = activeCar().startShield; combo = 1; maxCombo = 1;
    raceTime=0;safeTimer=0;raceDistance=0;nearMisses=0;turboUses=0;
    obstacles = []; coins = []; powerups = []; sparks = []; callouts=[]; spawnTimer = .75; coinTimer = .5; powerTimer = 7;
    $('score').textContent = '0'; $('runCoins').textContent = '0'; $('combo').textContent = '×1'; $('shieldPill').hidden = !shield;
    $('useNitro').classList.remove('active', 'ready');
    startPanel.hidden = true; resultPanel.hidden = true; touchControls.hidden = false;
    state = 'playing'; setNitro(0); lastTime = performance.now();
    tg?.HapticFeedback?.impactOccurred('medium');
    gameScreen.classList.remove('race-crash','new-record');window.TelePlayGameShell.SoundManager.startEngine();
    window.TelePlayGameShell.emit('neon_race_started',{gameId:'neon-race',vehicleId:activeVehicle().id});
    window.TelePlayGameShell.emit('game_started',{gameId:'neon-race'});
  }

  function finishRace() {
    if (state !== 'playing') return;
    state = 'ended'; touchControls.hidden = true;
    const final = Math.floor(score);
    window.TelePlayGameShell.SoundManager.stopEngine();
    const stats = window.TelePlayGameShell.saveResult('neon-race',final);
    const isBest=stats.newRecord; storage.best=stats.bestScore;
    const totalReward=runCoins;
    window.TelePlayCore.RewardManager.award('neon-race',{coins:totalReward,score:final,metadata:{transactionId:`game:neon-race:run:${runToken}`,runToken}});
    window.TelePlayGameShell.ResultScreen.show(resultPanel,{score:final,bestScore:stats.bestScore,reward:totalReward,newRecord:isBest,title:'Отличный<br>заезд!',details:{distance:`${Math.floor(raceDistance).toLocaleString('ru-RU')} м`,nearMisses,maxCombo:`×${maxCombo}`} });
    renderVehicleProgress($('vehicleProgress'));
    window.TelePlayGameShell.emit('neon_race_finished',{gameId:'neon-race',score:final,bestScore:stats.bestScore,coins:runCoins,maxCombo,nearMisses,turboUses,duration:Math.floor(raceTime),distance:Math.floor(raceDistance)});
    window.TelePlayGameShell.emit('game_finished',{gameId:'neon-race',score:final,reward:runCoins,maxCombo,playTime:Math.floor(raceTime),distance:Math.floor(raceDistance)});
    window.TelePlayGameShell.emit('reward_claimed',{gameId:'neon-race',reward:totalReward});
    if(isBest){gameScreen.classList.add('new-record');window.TelePlayGameShell.emit('neon_race_new_record',{gameId:'neon-race',score:final});window.TelePlayGameShell.emit('new_record',{gameId:'neon-race',score:final});window.TelePlayGameShell.SoundManager.play('record');tg?.HapticFeedback?.notificationOccurred('success')}
    else window.TelePlayGameShell.SoundManager.play('gameover');
    updateStoredUI(); callbacks.onWalletChange?.();
  }

  function registerWebMCP() {
    const context = document.modelContext;
    if (!context?.registerTool) return;
    const register = (tool) => { try { void Promise.resolve(context.registerTool(tool)).catch(() => {}); } catch (_) {} };
    register({ name: 'start_race', title: 'Начать гонку', description: 'Открывает игру и начинает новый заезд.', inputSchema: { type: 'object', properties: {}, additionalProperties: false }, annotations: { readOnlyHint: false, untrustedContentHint: false }, execute: async () => { open(); startRace(); return { status: 'playing', lane }; } });
    register({ name: 'move_race_car', title: 'Перестроить машину', description: 'Перемещает машину на одну полосу влево или вправо во время гонки.', inputSchema: { type: 'object', properties: { direction: { type: 'string', enum: ['left','right'] } }, required: ['direction'], additionalProperties: false }, annotations: { readOnlyHint: false, untrustedContentHint: false }, execute: async input => { const moved=move(input.direction==='left'?-1:1); return {moved,lane,status:state}; } });
    register({ name: 'activate_nitro', title: 'Включить нитро', description: 'Тратит заряд и временно ускоряет машину.', inputSchema: { type: 'object', properties: {}, additionalProperties: false }, annotations: { readOnlyHint: false, untrustedContentHint: false }, execute: async () => ({ activated: useNitro(), nitro: Math.floor(nitro), status: state }) });
    register({ name: 'get_race_state', title: 'Состояние гонки', description: 'Возвращает текущий счёт, монеты, полосу, комбо и состояние бонусов.', inputSchema: { type: 'object', properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true, untrustedContentHint: false }, execute: async () => ({ status: state, score: Math.floor(score), runCoins, lane, combo, nitro: Math.floor(nitro), shield, best: storage.best }) });
    register({ name: 'get_garage', title: 'Посмотреть гараж', description: 'Возвращает машины, цены, владение и выбранную машину.', inputSchema: { type: 'object', properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true, untrustedContentHint: false }, execute: async () => ({ coins: storage.coins, selected: storage.selectedCar, owned: storage.ownedCars, cars: Object.values(CARS).map(({ id, name, price, trait }) => ({ id, name, price, trait })) }) });
    register({ name: 'buy_garage_car', title: 'Купить машину', description: 'Покупает машину за игровые монеты и выбирает её.', inputSchema: { type: 'object', properties: { carId: { type: 'string', enum: ['volt', 'phantom'] } }, required: ['carId'], additionalProperties: false }, annotations: { readOnlyHint: false, untrustedContentHint: false }, execute: async input => buyOrSelectCar(input?.carId) });
  }
  function init(){
    $('startRace').addEventListener('click',startRace);$('restartRace').addEventListener('click',startRace);$('gameGarage').addEventListener('click',openGarage);$('closeGarage').addEventListener('click',closeGarage);$('returnToRace').addEventListener('click',closeGarage);$('pauseGame').addEventListener('click',()=>{if(state==='playing'){state='paused';$('pauseGame').textContent='▶';window.TelePlayGameShell.SoundManager.stopEngine()}else if(state==='paused'){state='playing';lastTime=performance.now();$('pauseGame').textContent='Ⅱ';window.TelePlayGameShell.SoundManager.startEngine()}});$('moveLeft').addEventListener('pointerdown',()=>move(-1));$('moveRight').addEventListener('pointerdown',()=>move(1));$('useNitro').addEventListener('pointerdown',useNitro);
    gameScreen.addEventListener('pointerdown',e=>{if(e.target.closest('button'))return;swipeStart={x:e.clientX,y:e.clientY,time:performance.now()}});gameScreen.addEventListener('pointerup',e=>{if(swipeStart==null)return;const start=swipeStart,dx=e.clientX-start.x,dy=e.clientY-start.y;swipeStart=null;if(Math.abs(dx)>22&&Math.abs(dx)>Math.abs(dy))move(dx>0?1:-1);else if(Math.abs(dx)<12&&Math.abs(dy)<12&&performance.now()-start.time<280)move(e.clientX>innerWidth/2?1:-1)});gameScreen.addEventListener('pointercancel',()=>{swipeStart=null});window.addEventListener('keydown',e=>{if(e.key==='ArrowLeft')move(-1);if(e.key==='ArrowRight')move(1);if(e.key===' ')useNitro()});window.addEventListener('resize',resize);registerWebMCP();updateStoredUI();resize();requestAnimationFrame(loop);
  }
  function open(options={}){callbacks=options;active=true;storeView.hidden=true;$('soonScreen').hidden=true;$('garageScreen').hidden=true;gameScreen.hidden=false;state='menu';startPanel.hidden=false;resultPanel.hidden=true;touchControls.hidden=true;updateStoredUI();resize();draw();try{tg?.requestFullscreen();tg?.disableVerticalSwipes()}catch(_){} }
  function close(){hide();callbacks.onHome?.()}
  function hide(){active=false;state='menu';gameScreen.hidden=true;$('garageScreen').hidden=true;window.TelePlayGameShell.SoundManager.stopEngine();try{tg?.enableVerticalSwipes();tg?.exitFullscreen()}catch(_){} }
  function pause(){if(state==='playing'){$('pauseGame').click()}}
  function resume(){if(state==='paused'){$('pauseGame').click()}}
  function destroy(){hide()}
  let callbacks={};let active=false;
  window.NeonRaceGame={init,open,close,hide,start:startRace,restart:startRace,finish:finishRace,pause,resume,destroy,move,useNitro,openGarage,closeGarage,updateCatalog:updateStoredUI,isGarageOpen:()=>!$('garageScreen').hidden,getState:()=>({state,score,runCoins,lane,combo,nitro,shield})};
  init();
})();
