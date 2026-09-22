/* Game Registry: one metadata contract for catalog, routing and adapters. */
(() => {
  const categories = { all: 'Все', racing: 'Гонки', arcade: 'Аркады', puzzle: 'Пазлы', reaction: 'Реакция', logic: 'Логика', sport: 'Спорт' };
  const entries = [
    ['neon-race','Неоновый заезд','Обгоняй машины и ставь рекорды','racing','car','#00e7ff','NeonRaceGame','canvas'],
    ['block-grid','Block Grid','Собирай линии и комбо','puzzle','blocks','#a78bff','BlockGrid','puzzle'],
    ['beat-dash','Beat Dash','Поймай ритм и дойди до конца','reaction','wave','#ff61bc','BeatDashGame','canvas'],
    ['neon-hook','Neon Hook','Цепляйся. Лети. Не падай.','arcade','hook','#4ae4ff','NeonHookGame','canvas'],
    ['penalty-duel','Penalty Duel','Забей. Отбей. Победи.','sport','goal','#69efb4','PenaltyDuelGame','sports'],
    ['trick-lab','Trick Lab','Здесь очевидный ответ почти всегда неправильный','logic','bulb','#ffd46b','TrickLabGame','puzzle'],
    ['neon-drift','Neon Drift','Держи идеальный занос','racing','drift','#ff6cb4','NeonDriftGame','canvas'],
    ['core-drop','Core Drop','Пробивайся всё глубже','arcade','tower','#b28aff','CoreDropGame','canvas'],
    ['color-sort','Color Sort','Разложи всё по цветам','puzzle','flasks','#60e5db','ColorSortGame','puzzle'],
    ['ping-pong-rush','Ping Pong Rush','Быстрые матчи на реакцию','sport','paddle','#fa9870','PingPongRushGame','sports'],
    ['void','Void','Поглощай мир и становись больше','arcade','void','#9580ff','VoidGame','canvas'],
    ['tile-trio','Tile Trio','Найди три одинаковых','puzzle','tiles','#ffb86c','TileTrioGame','puzzle'],
    ['color-pulse','Color Pulse','Проходи только через свой цвет','reaction','ring','#59e6f4','ColorPulseGame','canvas'],
    ['core-shot','Core Shot','Попади точно в момент','reaction','target','#ff7c9f','CoreShotGame','canvas'],
    ['unbolt','Unbolt','Разбери конструкцию правильно','logic','bolt','#8ba5ff','UnboltGame','puzzle'],
    ['arrow-escape','Arrow Escape','Освободи все стрелки','logic','arrows','#83f0ad','ArrowEscapeGame','puzzle'],
    ['hoop-shot','Hoop Shot','Собери идеальную серию','sport','hoop','#ff9b55','HoopShotGame','sports'],
    ['stunt-ride','Stunt Ride','Безумные трассы и физика','racing','ramp','#c2ed6f','StuntRideGame','canvas']
  ];
  const games = entries.map(([id,title,subtitle,category,icon,color,component,engineType]) => ({ id,title,subtitle,category,icon,thumbnail:icon,color,component,engineType,status:['neon-race','block-grid','beat-dash','neon-hook','penalty-duel','core-drop'].includes(id)?'available':'coming-soon',featured:id==='neon-race' }));
  const car = '<rect x="66" y="24" width="30" height="66" rx="10" fill="currentColor"/><path d="M71 39h20l-2 17H73z" fill="#11162b"/><path d="M71 76h20M70 30h6m11 0h5" stroke="#fff"/>';
  const art = {
    car:'<path d="M43 0 24 120M116 0l20 120M80 0v16m0 84v20"/>'+car,
    drift:'<path d="M20 112Q135 90 35 12M45 118Q159 89 59 8" stroke-dasharray="7 6"/><g transform="rotate(35 80 60)">'+car+'</g>',
    ramp:'<path d="m10 101 59-20 30-22v44h48"/><g transform="translate(34 -4) rotate(60 80 60) scale(.8)">'+car+'</g>',
    blocks:'<g fill="currentColor"><rect x="37" y="22" width="25" height="25" rx="5"/><rect x="66" y="22" width="25" height="25" rx="5"/><rect x="66" y="51" width="25" height="25" rx="5"/><rect x="95" y="51" width="25" height="25" rx="5"/></g><path d="M37 88h83" stroke="#55f4db" stroke-width="8"/>',
    wave:'<path d="m12 73 23-28 21 38 24-52 23 58 22-33h25" stroke-width="5"/><rect x="75" y="25" width="12" height="12" transform="rotate(45 81 31)" fill="#fff"/>',
    hook:'<circle cx="110" cy="21" r="7" fill="#fff"/><path d="m110 28-50 45 9 18q10 14 22 0"/><circle cx="54" cy="81" r="12" fill="currentColor"/><path d="M20 101h30m60-45h35" stroke="#ab80ff" stroke-width="8"/>',
    goal:'<path d="M28 86V27h106v59M29 42h104M29 59h104M49 27v58m21-58v58m21-58v58m21-58v58"/><circle cx="82" cy="82" r="19" fill="#f7f8ff" stroke="#fff"/><path d="m82 69 10 8-4 12H76l-4-12z" fill="#162339" stroke="none"/>',
    bulb:'<path d="M64 78c0-15-15-17-15-36a31 31 0 0 1 62 0c0 19-15 21-15 36zM65 88h30m-26 9h22M80 2v-7M29 40H16m116 0h13"/><path d="m76 72 11-22H73l9-17" stroke="#fff"/>',
    tower:'<path d="M80 10v99" stroke="#ddd"/><g stroke-width="9"><path d="M41 39q40 19 80 0M41 61q40 19 80 0M41 84q40 19 80 0"/></g><circle cx="92" cy="24" r="10" fill="#ff6cb4" stroke="none"/>',
    flasks:'<path d="M32 21v66q0 13 13 13t13-13V21M69 21v66q0 13 13 13t13-13V21M106 21v66q0 13 13 13t13-13V21"/><path d="M45 65v22m37-39v39m37-19v19" stroke-width="17"/><path d="M45 45v15m37 23v4m37-41v15" stroke="#ff72ba" stroke-width="17"/>',
    paddle:'<g transform="rotate(30 80 60)"><ellipse cx="75" cy="43" rx="28" ry="32" fill="currentColor"/><path d="M75 76v26" stroke="#dad4ff" stroke-width="12"/></g><circle cx="126" cy="35" r="9" fill="#fff" stroke="none"/>',
    void:'<ellipse cx="80" cy="61" rx="62" ry="30" transform="rotate(-25 80 61)"/><ellipse cx="80" cy="61" rx="47" ry="24" transform="rotate(-25 80 61)" stroke="#ff70db"/><circle cx="80" cy="60" r="26" fill="#070914"/><circle cx="27" cy="25" r="5" fill="currentColor"/><path d="m128 93 10 5-2-12z"/>',
    tiles:'<g fill="#252744"><rect x="20" y="31" width="43" height="57" rx="9" transform="rotate(-15 42 60)"/><rect x="97" y="31" width="43" height="57" rx="9" transform="rotate(15 119 60)"/><rect x="59" y="24" width="43" height="64" rx="9"/></g><path d="m80 39 6 12 13 2-10 10 2 14-11-7-12 7 3-14-10-10 14-2z" fill="currentColor"/>',
    ring:'<circle cx="80" cy="60" r="38" stroke-width="12" stroke-dasharray="48 12"/><path d="M80 22a38 38 0 0 1 38 38" stroke="#ff64bd" stroke-width="12"/><circle cx="80" cy="63" r="10" fill="#fff" stroke="none"/>',
    target:'<circle cx="80" cy="49" r="26"/><circle cx="80" cy="49" r="11" fill="currentColor"/><path d="M80 101V82m-43-6 12-11m72 8-12-10M80 11V2" stroke-width="5"/>',
    bolt:'<path d="m54 33 26-15 26 15v30L80 78 54 63z" fill="#293657"/><circle cx="80" cy="48" r="13"/><path d="M72 78v22m16-22v22M69 87h22m-22 9h22"/>',
    arrows:'<path d="M28 92V30m-12 14 12-14 12 14M62 88h64m-15-12 15 12-15 12M76 57V20m-12 14 12-14 12 14M106 48h34m-12-12 12 12-12 12" stroke-width="6"/>',
    hoop:'<path d="M49 13h75v43H49zM64 56l8 40h28l10-40M75 56l7 40m16-40-6 40M68 73h38"/><ellipse cx="87" cy="56" rx="26" ry="6" stroke="#ff698b"/><circle cx="39" cy="75" r="19" fill="currentColor"/><path d="M20 75h38M39 56v38" stroke="#442c34"/>'
  };
  function GameArtwork(game) { return `<span class="catalog-art" style="--art-color:${game.color}"><svg viewBox="0 0 160 120" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${art[game.thumbnail]}</svg></span>`; }
  function GameCard(game) { return `<button class="catalog-card" data-game="${game.id}" style="--art-color:${game.color}" aria-label="${game.title} — ${game.status==='available'?'Играть':'Скоро'}">${GameArtwork(game)}<span class="catalog-copy"><small>${categories[game.category]}</small><b>${game.title}</b><span class="catalog-subtitle">${game.subtitle}</span><span class="catalog-action ${game.status==='available'?'available':''}">${game.status==='available'?'Играть ▶':'Скоро <span aria-hidden="true">↗</span>'}</span></span></button>`; }
  window.TelePlayCatalog = { games, categories, GameArtwork, GameCard };
})();
