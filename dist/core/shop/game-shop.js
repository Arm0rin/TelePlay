(() => {
  const normalizePrice = price => price && typeof price === 'object'
    ? { currency: String(price.currency || 'coins').toLowerCase() === 'gems' ? 'gems' : 'coins', amount: Math.max(0, Math.floor(Number(price.amount) || 0)) }
    : { currency: 'coins', amount: Math.max(0, Math.floor(Number(price) || 0)) };
  const normalizeItem = item => ({ ...item, price: normalizePrice(item?.price) });
  const create = ({ gameId, title, categories, items }) => {
    const catalogItems = Object.freeze((items || []).map(normalizeItem));
    const api = {
      gameId,
      title,
      getItems(category = 'all') { return (window.TelePlayCore.ShopManager.gameCatalog(gameId)?.items || []).filter(item => category === 'all' || item.category === category).map(item => { const raw = item.price, currency = raw && typeof raw === 'object' ? raw.currency : item.currencyType, price = raw && typeof raw === 'object' ? { currency: String(currency || 'coins').toLowerCase() === 'gems' ? 'gems' : 'coins', amount: Number(raw.amount || 0) } : { currency: String(currency || 'coins').toLowerCase() === 'gems' ? 'gems' : 'coins', amount: Number(raw || 0) }; const inventory = window.TelePlayCore.ShopManager.gameInventory(gameId); return { ...item, price, priceAmount: price.amount, currencyType: price.currency, visual: item.visual || item.visualData, visualData: item.visualData || item.visual, owned: inventory.ownedItems.includes(item.id), equipped: Object.values(inventory.equippedItems).includes(item.id) }; }); },
      buyItem(id) { return window.TelePlayCore.ShopManager.buyGameItem(gameId, id); },
      equipItem(id) { return window.TelePlayCore.ShopManager.equipGameItem(gameId, id); },
      unequipItem(slot) { return window.TelePlayCore.ShopManager.unequipGameItem(gameId, slot); },
      getOwnedItems() { return window.TelePlayCore.ShopManager.gameInventory(gameId).ownedItems; },
      getCategories() { return categories; },
      getInventory() { return window.TelePlayCore.ShopManager.gameInventory(gameId); },
      getCollection() { return window.TelePlayCore.ShopManager.gameCollection(gameId); },
      item(id) { return this.getItems('all').find(item => item.id === id) || null; }
    };
    window.TelePlayCore.ShopManager.registerGameShop({ gameId, title, categories, items: catalogItems, api });
    return api;
  };
  window.TelePlayGameShopEngine = { create };
})();
