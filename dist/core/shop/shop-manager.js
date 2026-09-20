(() => {
  const config = () => window.TelePlayShopConfig || {};
  const core = () => window.TelePlayCore || {};
  const gameCatalogs = {};
  const profileItem = id => (config().PROFILE_ITEMS || config().ITEMS || []).find(item => item.id === id) || null;
  const normalizeScope = input => { const source = input || {}; return { ownedItems: Array.from(new Set(Array.isArray(source.ownedItems) ? source.ownedItems : [])), equippedItems: { ...(source.equippedItems || {}) }, purchaseHistory: Array.isArray(source.purchaseHistory) ? source.purchaseHistory : [] }; };
  const profileInventory = () => normalizeScope(core().PlayerData.get().inventory?.profile);
  const gameInventory = gameId => normalizeScope(core().PlayerData.get().inventory?.games?.[gameId]);
  const inventoryWithProfile = profile => { const current = core().PlayerData.get().inventory || {}; return { ...current, profile: normalizeScope(profile), games: { ...(current.games || {}) } }; };
  const inventoryWithGame = (gameId, gameScope) => { const current = core().PlayerData.get().inventory || {}; return { ...current, profile: normalizeScope(current.profile), games: { ...(current.games || {}), [gameId]: normalizeScope(gameScope) } }; };
  const persist = inventory => core().PlayerData.set({ inventory });
  const priceOf = item => { const raw = item?.price; if (raw && typeof raw === 'object') return { currency: String(raw.currency || item.currencyType || 'coins').toLowerCase() === 'gems' ? 'gems' : 'coins', amount: Math.max(0, Math.floor(Number(raw.amount) || 0)) }; return { currency: String(item?.currencyType || 'coins').toLowerCase() === 'gems' ? 'gems' : 'coins', amount: Math.max(0, Math.floor(Number(raw) || 0)) }; };
  const decorate = (item, inventory) => { const price = priceOf(item); return { ...item, price, priceAmount: price.amount, currencyType: price.currency, visual: item.visual || item.visualData, visualData: item.visualData || item.visual, owned: inventory.ownedItems.includes(item.id), equipped: Object.values(inventory.equippedItems).includes(item.id) }; };
  const track = (event, item, params = {}) => { const price = priceOf(item); core().Analytics?.track?.(event, item?.gameId || null, { itemId: item?.id || null, category: item?.category || null, currencyType: price.currency, ...params }); };
  const payment = (item, source, metadata = {}) => { const price = priceOf(item), id = metadata.transactionId || `${source}:item:${item.id}`; return core().RewardManager?.spend?.(source, { currency: price.currency, amount: price.amount, transactionId: id, metadata: { itemId: item.id, price, ...metadata } }); };
  const gameItem = (gameId, slot = null) => {
    const inventory = gameInventory(gameId), catalog = gameCatalogs[gameId];
    if (!catalog) return null;
    const id = slot ? inventory.equippedItems[slot] : Object.values(inventory.equippedItems).find(itemId => catalog.items.some(item => item.id === itemId));
    const item = catalog.items.find(value => value.id === id);
    return item ? decorate(item, inventory) : null;
  };

  const ShopManager = {
    registerGameShop(catalog) { if (!catalog?.gameId) return null; gameCatalogs[catalog.gameId] = { ...catalog, items: Object.freeze((catalog.items || []).map(item => ({ ...item, gameId: catalog.gameId }))) }; return this.gameShop(catalog.gameId); },
    gameCatalog(gameId) { return gameCatalogs[gameId] || null; },
    gameShops() { return Object.values(gameCatalogs).map(({ gameId, title, categories }) => ({ gameId, title, categories })); },
    gameShop(gameId) { return gameCatalogs[gameId]?.api || null; },
    charge(source, amount, metadata = {}) { return payment({ id: metadata.itemId || source, price: { currency: 'coins', amount } }, source, metadata); },
    categories() { return config().CATEGORIES || {}; },
    inventory() { return profileInventory(); },
    profileInventory() { return profileInventory(); },
    gameInventory(gameId) { return gameInventory(gameId); },
    collection() { const inventory = profileInventory(), items = config().PROFILE_ITEMS || config().ITEMS || []; return { owned: inventory.ownedItems.length, total: items.length, equipped: Object.values(inventory.equippedItems).filter(Boolean).length }; },
    gameCollection(gameId) { const inventory = gameInventory(gameId), items = gameCatalogs[gameId]?.items || []; return { owned: inventory.ownedItems.length, total: items.length, equipped: Object.values(inventory.equippedItems).filter(Boolean).length }; },
    list(category = 'all') { const inventory = profileInventory(); return (config().PROFILE_ITEMS || config().ITEMS || []).filter(item => category === 'all' || item.category === category).map(item => decorate(item, inventory)); },
    item(id) { const item = profileItem(id); return item ? decorate(item, profileInventory()) : null; },
    buy(id) {
      const item = profileItem(id), inventory = profileInventory();
      if (!item) return { ok: false, reason: 'unknown_item' };
      if (inventory.ownedItems.includes(id)) return { ok: false, reason: 'owned', item: decorate(item, inventory), balance: priceOf(item).currency === 'gems' ? core().CurrencyManager.getGems() : core().CurrencyManager.getCoins() };
      const result = payment(item, 'teleplay-shop', { scope: 'profile' });
      if (!result?.ok) return { ok: false, reason: result?.reason || (priceOf(item).currency === 'gems' ? 'insufficient_gems' : 'insufficient_coins'), item: decorate(item, inventory), balance: result?.balance ?? (priceOf(item).currency === 'gems' ? core().CurrencyManager.getGems() : core().CurrencyManager.getCoins()) };
      const next = { ...inventory, ownedItems: [...inventory.ownedItems, id], purchaseHistory: [...inventory.purchaseHistory, { itemId: id, price: priceOf(item), transactionId: result.transaction?.id || null, purchasedAt: Date.now(), scope: 'profile' }] };
      persist(inventoryWithProfile(next)); track('item_purchased', item, { price: priceOf(item), rarity: item.rarity, balance: result.balance, scope: 'profile', premium: priceOf(item).currency === 'gems' }); if (priceOf(item).currency === 'gems') track('premium_item_purchased', item, { price: priceOf(item), balance: result.balance, scope: 'profile' });
      return { ok: true, item: decorate(item, next), balance: result.balance };
    },
    equip(id) {
      const item = profileItem(id), inventory = profileInventory();
      if (!item || !inventory.ownedItems.includes(id)) return { ok: false, reason: 'not_owned' };
      if (item.titleId) { core().PlayerData.unlockTitle(item.titleId, null, false); core().PlayerData.setActiveTitle(item.titleId); }
      const next = { ...inventory, equippedItems: { ...inventory.equippedItems, [item.slot || item.category]: id } }; persist(inventoryWithProfile(next)); track('item_equipped', item, { slot: item.slot || item.category, scope: 'profile' }); return { ok: true, item: decorate(item, next) };
    },
    unequip(slot) {
      const inventory = profileInventory(), id = inventory.equippedItems[slot], item = profileItem(id); if (!id) return { ok: false, reason: 'empty' };
      const equippedItems = { ...inventory.equippedItems }; delete equippedItems[slot]; if (slot === 'title') core().PlayerData.setActiveTitle('rookie'); persist(inventoryWithProfile({ ...inventory, equippedItems })); track('item_equipped', item, { slot, action: 'unequip', scope: 'profile' }); return { ok: true, item: item ? decorate(item, { ...inventory, equippedItems }) : null };
    },
    equipped(slot) { const inventory = profileInventory(), item = profileItem(inventory.equippedItems[slot]); return item ? decorate(item, inventory) : null; },
    buyGameItem(gameId, id) {
      const catalog = gameCatalogs[gameId], item = catalog?.items.find(value => value.id === id), inventory = gameInventory(gameId); if (!item) return { ok: false, reason: 'unknown_item' };
      if (inventory.ownedItems.includes(id)) return { ok: false, reason: 'owned', item: decorate(item, inventory), balance: priceOf(item).currency === 'gems' ? core().CurrencyManager.getGems() : core().CurrencyManager.getCoins() };
      const result = payment(item, `game-shop:${gameId}`, { scope: 'game', gameId }); if (!result?.ok) return { ok: false, reason: result?.reason || (priceOf(item).currency === 'gems' ? 'insufficient_gems' : 'insufficient_coins'), item: decorate(item, inventory), balance: result?.balance ?? (priceOf(item).currency === 'gems' ? core().CurrencyManager.getGems() : core().CurrencyManager.getCoins()) };
      const next = { ...inventory, ownedItems: [...inventory.ownedItems, id], purchaseHistory: [...inventory.purchaseHistory, { itemId: id, price: priceOf(item), transactionId: result.transaction?.id || null, purchasedAt: Date.now(), scope: 'game', gameId }] }; persist(inventoryWithGame(gameId, next)); track('item_purchased', item, { price: priceOf(item), rarity: item.rarity, balance: result.balance, scope: 'game', gameId, premium: priceOf(item).currency === 'gems' }); if (priceOf(item).currency === 'gems') track('premium_item_purchased', item, { price: priceOf(item), balance: result.balance, scope: 'game', gameId }); return { ok: true, item: decorate(item, next), balance: result.balance };
    },
    equipGameItem(gameId, id) {
      const catalog = gameCatalogs[gameId], item = catalog?.items.find(value => value.id === id), inventory = gameInventory(gameId); if (!item || !inventory.ownedItems.includes(id)) return { ok: false, reason: 'not_owned' };
      const slot = item.slot || item.category, next = { ...inventory, equippedItems: { ...inventory.equippedItems, [slot]: id } }; persist(inventoryWithGame(gameId, next)); track('item_equipped', item, { slot, scope: 'game', gameId }); return { ok: true, item: decorate(item, next) };
    },
    unequipGameItem(gameId, slot) {
      const inventory = gameInventory(gameId), id = inventory.equippedItems[slot], item = gameCatalogs[gameId]?.items.find(value => value.id === id); if (!id) return { ok: false, reason: 'empty' }; const equippedItems = { ...inventory.equippedItems }; delete equippedItems[slot]; const next = { ...inventory, equippedItems }; persist(inventoryWithGame(gameId, next)); track('item_equipped', item, { slot, action: 'unequip', scope: 'game', gameId }); return { ok: true, item: item ? decorate(item, next) : null };
    },
    visualForGame(gameId, slot = null) { const item = gameItem(gameId, slot); return item ? { ...(item.visualData || item.visual || {}), id: item.id, category: item.category, slot: item.slot || item.category } : null; },
    equippedForGame(gameId, slot = null) { return gameItem(gameId, slot); },
    createChallenge(gameId, score, metadata = {}) { return { id: `challenge-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, type: 'score-ghost', gameId, score: Number(score || 0), metadata, createdAt: Date.now() }; }
  };
  window.TelePlayCore ??= {}; window.TelePlayCore.ShopManager = ShopManager; window.TelePlayShop = ShopManager;
})();
