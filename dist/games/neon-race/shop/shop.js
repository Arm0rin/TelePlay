(() => {
  const make = (id, name, description, category, rarity, price, icon, color, accent) => ({
    id: `neon-race-${id}`, name, description, category, rarity, price, icon,
    slot: category, visualData: { color, accent }
  });
  const items = [
    make('neon-starter', 'Neon Starter', 'Стартовый cyan-стиль машины.', 'cars', 'common', 0, '▶', '#00e7ff', '#4e63ff'),
    make('cyber-racer', 'Cyber Racer', 'Глитч-панели и blue glow.', 'cars', 'rare', 150, '▰', '#61dfff', '#5d5cff'),
    make('shadow-racer', 'Shadow Racer', 'Тёмный корпус с violet edge.', 'cars', 'rare', 170, '◒', '#8792b7', '#373a68'),
    make('golden-racer', 'Golden Racer', 'Золотой корпус победителя.', 'cars', 'epic', 280, '◆', '#ffd75a', '#ff884d'),
    make('ice-racer', 'Ice Racer', 'Ледяной свет на трассе.', 'cars', 'epic', 300, '❄', '#baf5ff', '#62a9ff'),
    make('fire-racer', 'Fire Racer', 'Огненный визуальный стиль.', 'cars', 'epic', 330, '✹', '#ff6d8f', '#ff9a45'),
    make('galaxy-racer', 'Galaxy Racer', 'Космический градиент кузова.', 'cars', 'legendary', 480, '✦', '#b58cff', '#ef61dc'),
    make('legend-racer', 'Legend Racer', 'Редкий визуальный комплект.', 'cars', 'legendary', 650, '★', '#ffe493', '#ff5ac7'),
    make('neon-trail', 'Neon Trail', 'Cyan light trail.', 'trails', 'common', 90, '〰', '#5de8ff', '#7c6cff'),
    make('fire-trail', 'Fire Trail', 'Тёплый огненный след.', 'trails', 'rare', 180, '✹', '#ff718e', '#ffad48'),
    make('electric-trail', 'Electric Trail', 'Импульсный electric trail.', 'trails', 'epic', 260, '⚡', '#65f5ff', '#a36cff'),
    make('boost-glow', 'Boost Glow', 'Свечение ускорения.', 'effects', 'rare', 190, '✦', '#75ecff', '#5d6bff'),
    make('engine-effect', 'Engine Effect', 'Неоновый эффект двигателя.', 'effects', 'epic', 280, '◉', '#ff8cc0', '#8b6cff'),
    make('cyber-city', 'Cyber City', 'Фон ночного мегаполиса.', 'backgrounds', 'rare', 210, '▥', '#63dfff', '#5d6bff'),
    make('galaxy-road', 'Galaxy Road', 'Космическая трасса.', 'backgrounds', 'legendary', 420, '✦', '#b78cff', '#ed5fe0')
  ];
  window.TelePlayGameShops = window.TelePlayGameShops || {};
  window.TelePlayGameShops['neon-race'] = window.TelePlayGameShopEngine.create({
    gameId: 'neon-race', title: 'Neon Race Shop',
    categories: { all: 'Все', cars: 'Cars', trails: 'Trails', effects: 'Effects', backgrounds: 'Backgrounds' }, items
  });
  window.NeonRaceGameShop = window.TelePlayGameShops['neon-race'];
})();
