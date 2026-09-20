(() => {
  const make = (id, name, description, category, rarity, price, icon, color, accent) => ({
    id: `neon-hook-${id}`, name, description, category, rarity, price, icon,
    slot: category, visualData: { color, accent }
  });
  const items = [
    make('classic-hook', 'Classic Hook', 'Минималистичный metallic hook.', 'hooks', 'common', 0, '⌁', '#d4def5', '#7584b4'),
    make('neon-hook', 'Neon Hook', 'Базовый cyan energy hook.', 'hooks', 'common', 100, '↗', '#5bf3ff', '#a879ff'),
    make('cyber-hook', 'Cyber Hook', 'Технологичный hook с blue glow.', 'hooks', 'rare', 150, '⌘', '#6cdcff', '#6267ff'),
    make('golden-hook', 'Golden Hook', 'Золотая линия зацепа.', 'hooks', 'epic', 270, '◆', '#ffd66e', '#ff9e4d'),
    make('fire-hook', 'Fire Hook', 'Огненный energy trail.', 'hooks', 'epic', 300, '✹', '#ff6b91', '#ffad4d'),
    make('ice-hook', 'Ice Hook', 'Холодная прозрачная дуга.', 'hooks', 'epic', 300, '❄', '#a9f2ff', '#74a6ff'),
    make('galaxy-hook', 'Galaxy Hook', 'Фиолетовая космическая линия.', 'hooks', 'legendary', 470, '✦', '#b891ff', '#e65cff'),
    make('glow-trail', 'Glow Trail', 'Мягкое свечение линии.', 'particles', 'rare', 150, '〰', '#69edff', '#8071ff'),
    make('electric-trail', 'Electric Trail', 'Импульсные частицы.', 'particles', 'epic', 240, '⚡', '#65f5ff', '#a36cff'),
    make('fire-trail', 'Fire Trail', 'Огненный след крюка.', 'particles', 'epic', 260, '✹', '#ff718e', '#ffad48'),
    make('neon-sky', 'Neon Sky', 'Глубокий neon background.', 'backgrounds', 'rare', 190, '☄', '#63dfff', '#6e6cff'),
    make('cyber-city', 'Cyber City', 'Городская панорама.', 'backgrounds', 'epic', 300, '▥', '#b18bff', '#e55fe0')
  ];
  window.TelePlayGameShops = window.TelePlayGameShops || {};
  window.TelePlayGameShops['neon-hook'] = window.TelePlayGameShopEngine.create({
    gameId: 'neon-hook', title: 'Neon Hook Shop',
    categories: { all: 'Все', hooks: 'Hooks', particles: 'Particles', backgrounds: 'Backgrounds' }, items
  });
  window.NeonHookGameShop = window.TelePlayGameShops['neon-hook'];
})();
