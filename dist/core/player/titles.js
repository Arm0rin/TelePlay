(() => {
  const CATALOG = Object.freeze([
    { id: 'rookie', title: 'Новичок TelePlay', rarity: 'Common' },
    { id: 'speed_demon', title: 'Speed Demon', rarity: 'Rare' },
    { id: 'goal_hunter', title: 'Goal Hunter', rarity: 'Epic' },
    { id: 'neon_master', title: 'Neon Master', rarity: 'Legendary' },
    { id: 'arcade_legend', title: 'Arcade Legend', rarity: 'Legendary' },
    { id: 'shop_title_rookie', title: 'Rookie', rarity: 'Common' },
    { id: 'shop_title_explorer', title: 'Explorer', rarity: 'Common' },
    { id: 'shop_title_speed_demon', title: 'Speed Demon', rarity: 'Rare' },
    { id: 'shop_title_goal_hunter', title: 'Goal Hunter', rarity: 'Rare' },
    { id: 'shop_title_arcade_master', title: 'Arcade Master', rarity: 'Epic' },
    { id: 'shop_title_puzzle_brain', title: 'Puzzle Brain', rarity: 'Epic' },
    { id: 'shop_title_neon_legend', title: 'Neon Legend', rarity: 'Legendary' },
    { id: 'shop_title_cyber_player', title: 'Cyber Player', rarity: 'Rare' },
    { id: 'shop_title_elite_gamer', title: 'Elite Gamer', rarity: 'Epic' },
    { id: 'shop_title_champion', title: 'TelePlay Champion', rarity: 'Legendary' },
    { id: 'shop_title_galaxy', title: 'Galaxy Title', rarity: 'Legendary' }
  ]);
  const catalog = id => CATALOG.find(item => item.id === id) || CATALOG[0];
  function normalized(input = {}) { const unlocked = Array.from(new Set(['rookie', ...(input.unlockedTitleIds || input.unlocked || [])])).filter(id => CATALOG.some(item => item.id === id)); const activeTitleId = unlocked.includes(input.activeTitleId) ? input.activeTitleId : unlocked[unlocked.length - 1] || 'rookie'; return { unlockedTitleIds: unlocked, activeTitleId }; }
  window.TelePlayPlayer ??= {};
  window.TelePlayPlayer.Titles = { CATALOG, catalog, normalized };
})();
