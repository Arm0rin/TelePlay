(() => {
  const make = (id, name, description, category, rarity, price, icon, color, accent) => ({
    id: `block-grid-${id}`, name, description, category, rarity, price, icon,
    slot: category, visualData: { color, accent }
  });
  const items = [
    make('classic-neon', 'Classic Neon', 'Базовые neon blocks.', 'block-themes', 'common', 0, '▦', '#76e8ff', '#a477ff'),
    make('cyber-blocks', 'Cyber Blocks', 'Сетка с digital edge.', 'block-themes', 'rare', 130, '▦', '#62ddff', '#5b68ff'),
    make('galaxy-blocks', 'Galaxy Blocks', 'Космический блеск линий.', 'block-themes', 'epic', 230, '✦', '#b58dff', '#e65cff'),
    make('fire-blocks', 'Fire Blocks', 'Горячие блоки для комбо.', 'block-themes', 'rare', 150, '✹', '#ff708f', '#ffae4f'),
    make('ice-blocks', 'Ice Blocks', 'Холодная прозрачная тема.', 'block-themes', 'rare', 150, '❄', '#b9f7ff', '#69aeff'),
    make('gold-blocks', 'Gold Blocks', 'Золотое ощущение серии.', 'block-themes', 'epic', 290, '◆', '#ffde77', '#ff974d'),
    make('hologram-blocks', 'Hologram Blocks', 'Переливающаяся hologram-сетка.', 'block-themes', 'legendary', 430, '⬡', '#73f0d4', '#f069ff'),
    make('combo-effect', 'Combo Effect', 'Эффект очистки комбо.', 'effects', 'rare', 180, '×', '#72f0d4', '#f069ff'),
    make('break-effect', 'Break Effect', 'Энергичный эффект разрушения.', 'effects', 'epic', 260, '✦', '#65e9ff', '#9d6cff'),
    make('dark-grid', 'Dark Grid', 'Глубокий фон поля.', 'backgrounds', 'common', 80, '▦', '#7688aa', '#393f66'),
    make('space-grid', 'Space Grid', 'Космический фон поля.', 'backgrounds', 'epic', 320, '✦', '#b68dff', '#e85cff')
  ];
  window.TelePlayGameShops = window.TelePlayGameShops || {};
  window.TelePlayGameShops['block-grid'] = window.TelePlayGameShopEngine.create({
    gameId: 'block-grid', title: 'Block Grid Shop',
    categories: { all: 'Все', 'block-themes': 'Block Themes', backgrounds: 'Backgrounds', effects: 'Effects' }, items
  });
  window.BlockGridGameShop = window.TelePlayGameShops['block-grid'];
})();
