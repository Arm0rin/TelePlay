(() => {
  const make = (id, name, description, category, rarity, price, icon, color, accent) => ({
    id: `penalty-duel-${id}`, name, description, category, rarity, price, icon,
    slot: category, visualData: { color, accent }
  });
  const items = [
    make('classic-ball', 'Classic Ball', 'Чистый классический мяч.', 'balls', 'common', 0, '●', '#f7f8ff', '#97a7cc'),
    make('neon-ball', 'Neon Ball', 'Cyan glow на каждом ударе.', 'balls', 'common', 100, '●', '#68edff', '#6c72ff'),
    make('fire-ball', 'Fire Ball', 'Огненный визуальный след.', 'balls', 'rare', 160, '●', '#ff6b8e', '#ffac4b'),
    make('galaxy-ball', 'Galaxy Ball', 'Космический magenta gradient.', 'balls', 'epic', 280, '●', '#b68dff', '#e85cff'),
    make('cyber-ball', 'Cyber Ball', 'Digital pattern без бонусов силы.', 'balls', 'rare', 170, '●', '#63e0ff', '#626dff'),
    make('gold-ball', 'Gold Ball', 'Золотая вспышка после гола.', 'balls', 'epic', 300, '●', '#ffdc72', '#ff974f'),
    make('ice-ball', 'Ice Ball', 'Холодная ледяная оболочка.', 'balls', 'epic', 300, '●', '#b8f7ff', '#69b8ff'),
    make('fire-goal', 'Fire Goal', 'Огненный эффект гола.', 'goal-effects', 'rare', 180, '✹', '#ff6b8e', '#ffac4b'),
    make('lightning-goal', 'Lightning Goal', 'Молниеносная вспышка.', 'goal-effects', 'epic', 260, '⚡', '#65f5ff', '#a36cff'),
    make('galaxy-goal', 'Galaxy Goal', 'Космический эффект сетки.', 'goal-effects', 'legendary', 420, '✦', '#b68dff', '#e85cff'),
    make('cyber-stadium', 'Cyber Stadium', 'Неоновый cyber-стадион.', 'stadiums', 'rare', 220, '▥', '#63e0ff', '#626dff'),
    make('neon-arena', 'Neon Arena', 'Яркая neon-арена.', 'stadiums', 'epic', 320, '◈', '#b68dff', '#e85cff')
  ];
  window.TelePlayGameShops = window.TelePlayGameShops || {};
  window.TelePlayGameShops['penalty-duel'] = window.TelePlayGameShopEngine.create({
    gameId: 'penalty-duel', title: 'Penalty Duel Shop',
    categories: { all: 'Все', balls: 'Balls', 'goal-effects': 'Goal Effects', stadiums: 'Stadiums' }, items
  });
  window.PenaltyDuelGameShop = window.TelePlayGameShops['penalty-duel'];
})();
