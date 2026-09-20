(() => {
  const STATS_KEY = 'teleplay-game-stats';
  const readAll = () => { try { return JSON.parse(localStorage.getItem(STATS_KEY) || '{}'); } catch (_) { return {}; } };
  const core=()=>window.TelePlayCore;
  const getStats = gameId => ({ bestScore: 0, gamesPlayed: 0, lastScore: 0, ...(readAll()[gameId] || {}), ...(core()?.SaveManager?.read()?.records?.[gameId] || {}) });
  const saveResult = (gameId, score, extra = {}) => {
    const previous = getStats(gameId);
    const next = { ...previous, bestScore: Math.max(previous.bestScore, score), gamesPlayed: previous.gamesPlayed + 1, lastScore: score, ...extra };
    if(core()?.PlayerData?.record){core().PlayerData.record(gameId,next);return { ...next, newRecord: score > previous.bestScore };}
    const all = readAll();
    all[gameId] = next; localStorage.setItem(STATS_KEY, JSON.stringify(all));
    if(core()?.SaveManager){const save=core().SaveManager.read();core().SaveManager.write({...save,records:{...save.records,[gameId]:next}})}
    return { ...next, newRecord: score > previous.bestScore };
  };
  const mergeStats = (gameId, patch) => {
    if(core()?.PlayerData?.record){const next={...getStats(gameId),...patch};core().PlayerData.record(gameId,next);return next;}
    const all = readAll();
    all[gameId] = { ...getStats(gameId), ...patch };
    localStorage.setItem(STATS_KEY, JSON.stringify(all));
    if(core()?.SaveManager){const save=core().SaveManager.read();core().SaveManager.write({...save,records:{...save.records,[gameId]:all[gameId]}})}
    return all[gameId];
  };
  const coins = {
    get: () => core()?.CurrencyManager?.getBalance?.() ?? core()?.PlayerData?.coins?.() ?? 0,
    add: amount => { const result = core()?.CurrencyManager?.addCoins?.(amount, 'legacy_reward', { transactionId: `legacy:${Date.now()}:${Math.random().toString(36).slice(2, 7)}` }); return result?.balance ?? coins.get(); }
  };
  const emit = (name, detail = {}) => {
    const payload = { event: name, at: Date.now(), ...detail };
    if (core()?.GameSession?.handleEvent) return core().GameSession.handleEvent(name, payload.gameId, payload);
    core()?.PlayerData?.handleEvent?.(name, payload.gameId, payload);
    window.dispatchEvent(new CustomEvent(`teleplay:${name}`, { detail: payload }));
    window.dataLayer?.push(payload);
    return payload;
  };
  const SoundManager = (() => {
    let audio, engine;
    const tones = { place:[300,.035,'sine'], jump:[360,.06,'sine'], clear:[620,.12,'triangle'], combo:[880,.18,'sine'], gameover:[150,.3,'sawtooth'], record:[1040,.25,'triangle'], coin:[760,.07,'sine'], near:[430,.1,'triangle'], perfect:[700,.14,'triangle'], turbo:[220,.22,'sawtooth'], collision:[85,.32,'sawtooth'], hook:[520,.08,'triangle'], release:[280,.09,'sine'], perfectRelease:[980,.2,'triangle'], levelComplete:[780,.3,'sine'], death:[95,.28,'sawtooth'] };
    const enabled = () => localStorage.getItem('teleplay-sound') !== 'off';
    function play(name) {
      if (!enabled()) return;
      try {
        audio ||= new (window.AudioContext || window.webkitAudioContext)();
        const [frequency,duration,type] = tones[name] || tones.place;
        const oscillator = audio.createOscillator(), gain = audio.createGain();
        oscillator.type=type; oscillator.frequency.setValueAtTime(frequency,audio.currentTime);
        gain.gain.setValueAtTime(.055,audio.currentTime); gain.gain.exponentialRampToValueAtTime(.001,audio.currentTime+duration);
        oscillator.connect(gain).connect(audio.destination); oscillator.start(); oscillator.stop(audio.currentTime+duration);
      } catch (_) {}
    }
    function startEngine() {
      if (!enabled() || engine) return;
      try {
        audio ||= new (window.AudioContext || window.webkitAudioContext)();
        const oscillator=audio.createOscillator(), gain=audio.createGain();
        oscillator.type='sawtooth'; oscillator.frequency.value=52; gain.gain.value=.008;
        oscillator.connect(gain).connect(audio.destination); oscillator.start(); engine={oscillator,gain};
      } catch (_) {}
    }
    function setEngineSpeed(value) { if(engine) engine.oscillator.frequency.setTargetAtTime(48+Math.min(70,value*4),audio.currentTime,.08); }
    function stopEngine() { try{engine?.oscillator.stop()}catch(_){} engine=null; }
    function setEnabled(value) { localStorage.setItem('teleplay-sound',value?'on':'off'); if(!value)stopEngine(); }
    return { play, startEngine, setEngineSpeed, stopEngine, enabled, setEnabled };
  })();
  const ScoreSystem = {
    award: (points, multiplier=1) => Math.max(0,Math.floor(points))*Math.max(1,Math.floor(multiplier)),
    nextCombo: (current,max=5) => Math.min(max,Math.max(1,current)+1),
    resetCombo: () => 1
  };
  const ResultScreen = {
    show(container,{score,bestScore,reward,newRecord,title='Отличный<br>заезд!',details={}}) {
      const set=(name,value,html=false)=>{const el=container.querySelector(`[data-result="${name}"]`);if(el)el[html?'innerHTML':'textContent']=value};
      set('kicker',newRecord?'НОВЫЙ РЕКОРД':'ИГРА ОКОНЧЕНА');set('title',newRecord?'Новый<br>рекорд!':title,true);
      set('score',Number(score).toLocaleString('ru-RU'));set('best',Number(bestScore).toLocaleString('ru-RU'));set('reward',`+${reward} 🪙`);container.hidden=false;
      Object.entries(details).forEach(([key,value])=>set(key,String(value)));
    }
  };
  window.TelePlayGameShell = { getStats, saveResult, mergeStats, coins, emit, SoundManager, ScoreSystem, ResultScreen };
})();
