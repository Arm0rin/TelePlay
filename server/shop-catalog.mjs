/*
 * Server-owned shop catalog.
 *
 * The browser still renders the existing catalog, but a purchase is accepted
 * only when its item, currency, price and shop source match this table.  This
 * prevents a client from changing the amount in a spend request or minting an
 * arbitrary inventory item through metadata.
 */

const profile = {
  'avatar-frame-neon': ['coins', 0],
  'avatar-frame-cyber': ['coins', 70],
  'avatar-frame-fire': ['coins', 95],
  'avatar-frame-ice': ['coins', 95],
  'avatar-frame-galaxy': ['coins', 160],
  'avatar-frame-gold': ['coins', 210],
  'avatar-frame-electric': ['coins', 240],
  'avatar-frame-shadow': ['coins', 130],
  'avatar-frame-hologram': ['coins', 380],
  'avatar-frame-legend': ['coins', 520],
  'shop-title-rookie': ['coins', 60],
  'shop-title-explorer': ['coins', 80],
  'shop-title-speed-demon': ['coins', 130],
  'shop-title-goal-hunter': ['coins', 140],
  'shop-title-arcade-master': ['coins', 220],
  'shop-title-puzzle-brain': ['coins', 220],
  'shop-title-neon-legend': ['coins', 420],
  'shop-title-cyber-player': ['coins', 170],
  'shop-title-elite-gamer': ['coins', 300],
  'shop-title-champion': ['coins', 550],
  'badge-first-record': ['coins', 80],
  'badge-100-games': ['coins', 150],
  'badge-streak-master': ['coins', 240],
  'badge-xp-hunter': ['coins', 130],
  'badge-coin-collector': ['coins', 220],
  'badge-champion': ['coins', 450],
  'badge-master-player': ['coins', 520],
  'badge-neon-core': ['coins', 120],
  'badge-combo-maker': ['coins', 260],
  'badge-collector': ['coins', 110],
  'collection-starter': ['coins', 120],
  'collection-cyber-pass': ['coins', 360],
  'collection-neon-legend': ['coins', 800],
  'premium-diamond-frame': ['gems', 100],
  'premium-galaxy-title': ['gems', 150],
  'premium-legend-badge': ['gems', 200]
};

const game = {
  'neon-race': {
    'neon-race-neon-starter': ['coins', 0],
    'neon-race-cyber-racer': ['coins', 150],
    'neon-race-shadow-racer': ['coins', 170],
    'neon-race-golden-racer': ['coins', 280],
    'neon-race-ice-racer': ['coins', 300],
    'neon-race-fire-racer': ['coins', 330],
    'neon-race-galaxy-racer': ['coins', 480],
    'neon-race-legend-racer': ['coins', 650],
    'neon-race-neon-trail': ['coins', 90],
    'neon-race-fire-trail': ['coins', 180],
    'neon-race-electric-trail': ['coins', 260],
    'neon-race-boost-glow': ['coins', 190],
    'neon-race-engine-effect': ['coins', 280],
    'neon-race-cyber-city': ['coins', 210],
    'neon-race-galaxy-road': ['coins', 420]
  },
  'block-grid': {
    'block-grid-classic-neon': ['coins', 0],
    'block-grid-cyber-blocks': ['coins', 130],
    'block-grid-galaxy-blocks': ['coins', 230],
    'block-grid-fire-blocks': ['coins', 150],
    'block-grid-ice-blocks': ['coins', 150],
    'block-grid-gold-blocks': ['coins', 290],
    'block-grid-hologram-blocks': ['coins', 430],
    'block-grid-combo-effect': ['coins', 180],
    'block-grid-break-effect': ['coins', 260],
    'block-grid-dark-grid': ['coins', 80],
    'block-grid-space-grid': ['coins', 320]
  },
  'beat-dash': {
    'beat-dash-neon-runner': ['coins', 0],
    'beat-dash-cyber-runner': ['coins', 150],
    'beat-dash-shadow-runner': ['coins', 160],
    'beat-dash-fire-runner': ['coins', 280],
    'beat-dash-ice-runner': ['coins', 280],
    'beat-dash-rainbow-trail': ['coins', 180],
    'beat-dash-electric-trail': ['coins', 240],
    'beat-dash-fire-trail': ['coins', 260],
    'beat-dash-jump-effect': ['coins', 170],
    'beat-dash-perfect-effect': ['coins', 290],
    'beat-dash-cyber-world': ['coins', 220],
    'beat-dash-space-world': ['coins', 420]
  },
  'neon-hook': {
    'neon-hook-classic-hook': ['coins', 0],
    'neon-hook-neon-hook': ['coins', 100],
    'neon-hook-cyber-hook': ['coins', 150],
    'neon-hook-golden-hook': ['coins', 270],
    'neon-hook-fire-hook': ['coins', 300],
    'neon-hook-ice-hook': ['coins', 300],
    'neon-hook-galaxy-hook': ['coins', 470],
    'neon-hook-glow-trail': ['coins', 150],
    'neon-hook-electric-trail': ['coins', 240],
    'neon-hook-fire-trail': ['coins', 260],
    'neon-hook-neon-sky': ['coins', 190],
    'neon-hook-cyber-city': ['coins', 300]
  },
  'penalty-duel': {
    'penalty-duel-classic-ball': ['coins', 0],
    'penalty-duel-neon-ball': ['coins', 100],
    'penalty-duel-fire-ball': ['coins', 160],
    'penalty-duel-galaxy-ball': ['coins', 280],
    'penalty-duel-cyber-ball': ['coins', 170],
    'penalty-duel-gold-ball': ['coins', 300],
    'penalty-duel-ice-ball': ['coins', 300],
    'penalty-duel-fire-goal': ['coins', 180],
    'penalty-duel-lightning-goal': ['coins', 260],
    'penalty-duel-galaxy-goal': ['coins', 420],
    'penalty-duel-cyber-stadium': ['coins', 220],
    'penalty-duel-neon-arena': ['coins', 320]
  }
};

const entries = {};
for (const [itemId, [currency, amount]] of Object.entries(profile)) entries[itemId] = { currency, amount, scope: 'profile' };
for (const [gameId, items] of Object.entries(game)) {
  for (const [itemId, [currency, amount]] of Object.entries(items)) entries[itemId] = { currency, amount, scope: 'game', gameId };
}

export const SHOP_CATALOG = Object.freeze(entries);
