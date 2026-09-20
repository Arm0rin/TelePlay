(() => {
  const RARITIES = Object.freeze({
    common: { id: 'common', label: 'Common', color: '#aeb9d5', glow: '#8d9bbd' },
    rare: { id: 'rare', label: 'Rare', color: '#61e7ff', glow: '#00cfff' },
    epic: { id: 'epic', label: 'Epic', color: '#c79aff', glow: '#956dff' },
    legendary: { id: 'legendary', label: 'Legendary', color: '#ffd86b', glow: '#ff9f43' }
  });
  const normalizePrice = price => price && typeof price === 'object'
    ? { currency: String(price.currency || 'coins').toLowerCase() === 'gems' ? 'gems' : 'coins', amount: Math.max(0, Math.floor(Number(price.amount) || 0)) }
    : { currency: 'coins', amount: Math.max(0, Math.floor(Number(price) || 0)) };
  const item = (id, name, description, category, rarity, price, icon, extra = {}) => ({ id, name, description, category, rarity, price: normalizePrice(price), icon, owned: false, equipped: false, ...extra });

  const PROFILE_ITEMS = [
    item('avatar-frame-neon', 'Neon Frame', 'Тонкая cyan-рамка для аватара.', 'avatar-frames', 'common', 0, '◈', { slot: 'avatarFrame', visual: { color: '#5de8ff', accent: '#8b6cff' } }),
    item('avatar-frame-cyber', 'Cyber Frame', 'Глитч-рамка с цифровым свечением.', 'avatar-frames', 'rare', 70, '⌘', { slot: 'avatarFrame', visual: { color: '#62d7ff', accent: '#566aff' } }),
    item('avatar-frame-fire', 'Fire Frame', 'Горячий magenta-orange контур.', 'avatar-frames', 'rare', 95, '✹', { slot: 'avatarFrame', visual: { color: '#ff6b91', accent: '#ffb347' } }),
    item('avatar-frame-ice', 'Ice Frame', 'Холодное голубое свечение.', 'avatar-frames', 'rare', 95, '❄', { slot: 'avatarFrame', visual: { color: '#8eeaff', accent: '#b3f4ff' } }),
    item('avatar-frame-galaxy', 'Galaxy Frame', 'Глубокий космический градиент.', 'avatar-frames', 'epic', 160, '✦', { slot: 'avatarFrame', visual: { color: '#a987ff', accent: '#e65cff' } }),
    item('avatar-frame-gold', 'Gold Frame', 'Золотой статусный контур.', 'avatar-frames', 'epic', 210, '◆', { slot: 'avatarFrame', visual: { color: '#ffd66e', accent: '#ff9b55' } }),
    item('avatar-frame-electric', 'Electric Frame', 'Рваная электрическая дуга.', 'avatar-frames', 'epic', 240, '⚡', { slot: 'avatarFrame', visual: { color: '#61f4ff', accent: '#b06cff' } }),
    item('avatar-frame-shadow', 'Shadow Frame', 'Тёмный stealth-эффект.', 'avatar-frames', 'rare', 130, '◐', { slot: 'avatarFrame', visual: { color: '#8694b8', accent: '#31395b' } }),
    item('avatar-frame-hologram', 'Hologram Frame', 'Переливающийся holographic edge.', 'avatar-frames', 'legendary', 380, '⬡', { slot: 'avatarFrame', visual: { color: '#72f0d4', accent: '#f06bff' } }),
    item('avatar-frame-legend', 'Legend Frame', 'Рамка для самых редких коллекций.', 'avatar-frames', 'legendary', 520, '★', { slot: 'avatarFrame', visual: { color: '#ffe58a', accent: '#ff5db1' } })
  ];
  const TITLE_ITEMS = [
    item('shop-title-rookie', 'Rookie', 'Первый шаг в неоновую лигу.', 'titles', 'common', 60, 'Ⅰ', { slot: 'title', titleId: 'shop_title_rookie' }),
    item('shop-title-explorer', 'Explorer', 'Открывает новые маршруты TelePlay.', 'titles', 'common', 80, '⌁', { slot: 'title', titleId: 'shop_title_explorer' }),
    item('shop-title-speed-demon', 'Speed Demon', 'Для тех, кто всегда ускоряется.', 'titles', 'rare', 130, '≫', { slot: 'title', titleId: 'shop_title_speed_demon' }),
    item('shop-title-goal-hunter', 'Goal Hunter', 'Цель найдена. Удар принят.', 'titles', 'rare', 140, '◎', { slot: 'title', titleId: 'shop_title_goal_hunter' }),
    item('shop-title-arcade-master', 'Arcade Master', 'Мастер коротких игровых сессий.', 'titles', 'epic', 220, '✦', { slot: 'title', titleId: 'shop_title_arcade_master' }),
    item('shop-title-puzzle-brain', 'Puzzle Brain', 'Логика, собранная в комбо.', 'titles', 'epic', 220, '▦', { slot: 'title', titleId: 'shop_title_puzzle_brain' }),
    item('shop-title-neon-legend', 'Neon Legend', 'Неоновая история продолжается.', 'titles', 'legendary', 420, '✧', { slot: 'title', titleId: 'shop_title_neon_legend' }),
    item('shop-title-cyber-player', 'Cyber Player', 'Играет на частоте будущего.', 'titles', 'rare', 170, '⌘', { slot: 'title', titleId: 'shop_title_cyber_player' }),
    item('shop-title-elite-gamer', 'Elite Gamer', 'Точный выбор и чистый результат.', 'titles', 'epic', 300, '◆', { slot: 'title', titleId: 'shop_title_elite_gamer' }),
    item('shop-title-champion', 'TelePlay Champion', 'Коллекционер побед и рекордов.', 'titles', 'legendary', 550, '♛', { slot: 'title', titleId: 'shop_title_champion' })
  ];
  const BADGE_ITEMS = [
    item('badge-first-record', 'First Record', 'Знак первого личного рекорда.', 'profile', 'common', 80, '🏆', { slot: 'badge' }),
    item('badge-100-games', '100 Games', 'Для постоянных игроков.', 'profile', 'rare', 150, '🎮', { slot: 'badge' }),
    item('badge-streak-master', 'Streak Master', 'Серия, которой можно гордиться.', 'profile', 'epic', 240, '🔥', { slot: 'badge' }),
    item('badge-xp-hunter', 'XP Hunter', 'Охота за каждым уровнем.', 'profile', 'rare', 130, '⚡', { slot: 'badge' }),
    item('badge-coin-collector', 'Coin Collector', 'Монеты превращаются в коллекцию.', 'profile', 'epic', 220, '🪙', { slot: 'badge' }),
    item('badge-champion', 'Champion', 'Золотой знак результата.', 'profile', 'legendary', 450, '♛', { slot: 'badge' }),
    item('badge-master-player', 'Master Player', 'Мастер всех игровых ритмов.', 'profile', 'legendary', 520, '✹', { slot: 'badge' }),
    item('badge-neon-core', 'Neon Core', 'Энергия TelePlay внутри.', 'profile', 'rare', 120, '●', { slot: 'badge' }),
    item('badge-combo-maker', 'Combo Maker', 'Комбо — твой второй язык.', 'profile', 'epic', 260, '×', { slot: 'badge' }),
    item('badge-collector', 'Collector', 'Начало большой коллекции.', 'profile', 'rare', 110, '⬡', { slot: 'badge' })
  ];

  const SPECIAL_ITEMS = [
    item('collection-starter', 'Starter Collection', 'Знак первого собранного набора.', 'special', 'common', 120, '◇', { slot: 'collectionBadge' }),
    item('collection-cyber-pass', 'Cyber Collection', 'Коллекционный hologram-бейдж.', 'special', 'epic', 360, '⬡', { slot: 'collectionBadge' }),
    item('collection-neon-legend', 'Neon Legend Set', 'Особый визуальный знак коллекционера.', 'special', 'legendary', 800, '★', { slot: 'collectionBadge' })
  ];
  const PREMIUM_ITEMS = [
    item('premium-diamond-frame', 'Diamond Frame', 'Премиальная рамка с бриллиантовым свечением.', 'premium', 'legendary', { currency: 'gems', amount: 100 }, '◇', { slot: 'avatarFrame', visual: { color: '#aef8ff', accent: '#ffffff' }, premium: true }),
    item('premium-galaxy-title', 'Galaxy Title', 'Статусный титул для коллекции TeleGems.', 'premium', 'legendary', { currency: 'gems', amount: 150 }, '✦', { slot: 'title', titleId: 'shop_title_galaxy', premium: true }),
    item('premium-legend-badge', 'Legend Badge', 'Коллекционный знак премиального профиля.', 'premium', 'legendary', { currency: 'gems', amount: 200 }, '♛', { slot: 'badge', premium: true })
  ];

  const ITEMS = Object.freeze([...PROFILE_ITEMS, ...TITLE_ITEMS, ...BADGE_ITEMS, ...SPECIAL_ITEMS, ...PREMIUM_ITEMS]);
  const CATEGORIES = Object.freeze({ all: 'Все', profile: 'Profile Badges', titles: 'Titles', 'avatar-frames': 'Avatar Frames', special: 'Profile Cosmetics', premium: 'Premium Collection' });
  // Payment-ready catalog only. These are data records for a future provider;
  // no UI, checkout or real-money flow is enabled at this stage.
  const GEM_PACKAGES = Object.freeze([
    { id: 'gem-pack-small', name: 'Small Pack', gemsAmount: 100, price: null, currency: 'fiat', provider: null },
    { id: 'gem-pack-medium', name: 'Medium Pack', gemsAmount: 500, price: null, currency: 'fiat', provider: null },
    { id: 'gem-pack-large', name: 'Large Pack', gemsAmount: 1200, price: null, currency: 'fiat', provider: null }
  ]);
  window.TelePlayShopConfig = Object.freeze({ RARITIES, ITEMS, PROFILE_ITEMS: ITEMS, CATEGORIES, GEM_PACKAGES, starterItemIds: ['avatar-frame-neon'] });
})();
