(() => {
  const CARS = {
    spark: { id: 'spark', name: 'Искра', price: 0, color: '#00dff4', accent: '#4e63ff', label: 'СТАРТОВАЯ', trait: 'Сбалансированная машина без штрафов.', nitroGain: 1, startShield: false },
    volt: { id: 'volt', name: 'Вольт', price: 20, color: '#ffd75a', accent: '#ff7b31', label: 'НИТРО', trait: 'Заряжает нитро на 35% быстрее.', nitroGain: 1.35, startShield: false },
    phantom: { id: 'phantom', name: 'Фантом', price: 55, color: '#ff4cad', accent: '#854dff', label: 'ЗАЩИТА', trait: 'Начинает каждый заезд с активным щитом.', nitroGain: 1, startShield: true }
  };
  const VEHICLES = [
    { id:'neon-car', name:'Neon Car', speedBonus:0, handlingBonus:0, visual:'spark', locked:false, legacyCarId:'spark' },
    { id:'cyber-gt', name:'Cyber GT', speedBonus:.45, handlingBonus:.08, visual:'volt', locked:true, legacyCarId:'volt' },
    { id:'future-x', name:'Future X', speedBonus:.7, handlingBonus:.12, visual:'phantom', locked:true, legacyCarId:'phantom' }
  ];
  const RACE_RULES = {
    difficulty(elapsed) {
      const pressure=elapsed<20?elapsed/20*.12:Math.min(.58,.12+(elapsed-20)/135);
      return { speed:Math.min(13.5,5+Math.max(0,elapsed-7)*.095), spawnDelay:Math.max(.4,1.22-pressure), doubleChance:elapsed<20?.04:Math.min(.38,.12+(elapsed-20)/170) };
    },
    pass(gap,width) { return gap>34&&gap<width*.52?'perfect':gap>34&&gap<width*.82?'near':null; }
  };
  const BOOSTERS = {
    turbo:{id:'turbo',duration:2.8,scoreMultiplier:2,invulnerable:true,enabled:true},
    shield:{id:'shield',enabled:false}, magnet:{id:'magnet',enabled:false}, slowMotion:{id:'slow-motion',enabled:false}
  };
  window.NeonRaceConfig = Object.freeze({CARS,VEHICLES,RACE_RULES,BOOSTERS});
})();
