(() => {
  const make = (id, name, description, category, rarity, price, icon, color, accent) => ({
    id: `beat-dash-${id}`, name, description, category, rarity, price, icon,
    slot: category, visualData: { color, accent }
  });
  const items = [
    make('neon-runner', 'Neon Runner', 'Cyan energy core.', 'runner-style', 'common', 0, '●', '#62efff', '#a779ff'),
    make('cyber-runner', 'Cyber Runner', 'Digital shell для Neon Core.', 'runner-style', 'rare', 150, '⌘', '#68dcff', '#6267ff'),
    make('shadow-runner', 'Shadow Runner', 'Тёмный stealth-профиль.', 'runner-style', 'rare', 160, '◒', '#8792b7', '#3b3d69'),
    make('fire-runner', 'Fire Runner', 'Огненная оболочка движения.', 'runner-style', 'epic', 280, '✹', '#ff6b91', '#ffab4d'),
    make('ice-runner', 'Ice Runner', 'Ледяной glow на прыжке.', 'runner-style', 'epic', 280, '❄', '#b4f6ff', '#69aaff'),
    make('rainbow-trail', 'Rainbow Trail', 'Радужный след движения.', 'trails', 'rare', 180, '〰', '#ff8cf3', '#68f5d5'),
    make('electric-trail', 'Electric Trail', 'Электрический след.', 'trails', 'epic', 240, '⚡', '#65f5ff', '#a36cff'),
    make('fire-trail', 'Fire Trail', 'Огненный след прыжка.', 'trails', 'epic', 260, '✹', '#ff718e', '#ffad48'),
    make('jump-effect', 'Jump Effect', 'Энергетическая вспышка при прыжке.', 'effects', 'rare', 170, '✧', '#69edff', '#8b6cff'),
    make('perfect-effect', 'Perfect Effect', 'Особый импульс идеального прыжка.', 'effects', 'epic', 290, '✦', '#ffd66e', '#ff6bba'),
    make('cyber-world', 'Cyber World', 'Digital мир уровня.', 'world-themes', 'rare', 220, '▥', '#63dfff', '#5d6bff'),
    make('space-world', 'Space World', 'Космическая сцена.', 'world-themes', 'legendary', 420, '✦', '#b78cff', '#ed5fe0')
  ];
  window.TelePlayGameShops = window.TelePlayGameShops || {};
  window.TelePlayGameShops['beat-dash'] = window.TelePlayGameShopEngine.create({
    gameId: 'beat-dash', title: 'Beat Dash Shop',
    categories: { all: 'Все', 'runner-style': 'Runner Style', trails: 'Trails', effects: 'Effects', 'world-themes': 'World Themes' }, items
  });
  window.BeatDashGameShop = window.TelePlayGameShops['beat-dash'];
})();
