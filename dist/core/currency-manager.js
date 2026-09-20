(() => {
  const MAX_TRANSACTIONS = 200;
  const core = () => window.TelePlayCore || {};
  const player = () => core().PlayerData;
  const integer = value => Math.max(0, Math.floor(Number(value) || 0));
  const clone = value => JSON.parse(JSON.stringify(value));
  const normalizeCurrency = value => String(value || 'coins').toLowerCase() === 'gems' ? 'gems' : 'coins';
  const operationId = (metadata, type, source) => {
    const provided = metadata?.transactionId || metadata?.rewardId || metadata?.operationId;
    if (provided) return String(provided);
    return `currency:${type}:${source || 'system'}:${Date.now()}:${Math.random().toString(36).slice(2, 9)}`;
  };
  const metadataFor = (metadata, id) => ({ ...(metadata || {}), transactionId: id });
  const transactions = () => {
    const value = player()?.get?.().currencyTransactions;
    return Array.isArray(value) ? value : [];
  };
  const findTransaction = (id, currencyType) => transactions().find(item => item?.id === id && normalizeCurrency(item.currencyType) === currencyType) || null;
  const balanceOf = (state, currencyType) => Number(state?.[currencyType] || 0);
  const conflict = (transaction, type, currencyType) => transaction && transaction.type !== type ? { ok: false, reason: 'transaction_conflict', balance: balanceOf(player()?.get?.(), currencyType), transaction: clone(transaction) } : null;
  const resultForDuplicate = (transaction, type, currencyType) => {
    const amount = Math.abs(Number(transaction?.amount || 0));
    return { ok: true, duplicate: true, added: type === 'earn' ? 0 : undefined, spent: type === 'spend' ? amount : undefined, balance: balanceOf(player()?.get?.(), currencyType), transaction: clone(transaction) };
  };
  const append = (current, transaction, currencyType, balance, statistics) => {
    const history = [...(Array.isArray(current.currencyTransactions) ? current.currencyTransactions : []), transaction].slice(-MAX_TRANSACTIONS);
    return player().set({ [currencyType]: balance, statistics, currencyTransactions: history });
  };
  const emit = (event, source, params) => core().Analytics?.track?.(event, source || null, params);
  const earnEvent = currencyType => currencyType === 'gems' ? 'gems_received' : 'coins_earned';
  const spendEvent = currencyType => currencyType === 'gems' ? 'gems_spent' : 'coins_spent';

  const add = (amount, currencyType, source = 'system', metadata = {}) => {
    const gain = integer(amount), id = operationId(metadata, 'earn', source), duplicate = findTransaction(id, currencyType);
    if (core().DataProvider?.isBackendEnabled?.()) return { ok: false, added: 0, balance: balanceOf(player()?.get?.(), currencyType), reason: 'reward_proof_required' };
    if (duplicate) return conflict(duplicate, 'earn', currencyType) || resultForDuplicate(duplicate, 'earn', currencyType);
    const current = player().get(), balance = balanceOf(current, currencyType);
    if (!gain && !metadata?.transactionId && !metadata?.rewardId && !metadata?.operationId) return { ok: true, added: 0, balance, transaction: null };
    const transaction = { id, currencyType, type: 'earn', source: String(source || 'system'), amount: gain, balanceAfter: balance + gain, metadata: metadataFor(metadata, id), createdAt: Date.now() };
    const statistics = { ...(current.statistics || {}) };
    if (currencyType === 'coins') statistics.totalCoinsEarned = Number(statistics.totalCoinsEarned || 0) + gain;
    const saved = append(current, transaction, currencyType, balance + gain, statistics);
    core().DataProvider?.recordTransaction?.(transaction);
    emit(earnEvent(currencyType), source, { currencyType, [currencyType]: gain, amount: gain, balance: saved[currencyType], transactionId: id, metadata: transaction.metadata });
    if (currencyType === 'coins') player().checkAchievements?.('coins_earned', source, { amount: gain, transactionId: id });
    return { ok: true, added: gain, balance: Number(saved[currencyType] || balance + gain), transaction };
  };
  const spend = (amount, currencyType, source = 'system', metadata = {}) => {
    const cost = integer(amount), id = operationId(metadata, 'spend', source), duplicate = findTransaction(id, currencyType);
    if (duplicate) return conflict(duplicate, 'spend', currencyType) || resultForDuplicate(duplicate, 'spend', currencyType);
    const current = player().get(), balance = balanceOf(current, currencyType);
    if (!cost) return { ok: true, spent: 0, balance, transaction: null };
    if (balance < cost) return { ok: false, spent: 0, balance, reason: currencyType === 'gems' ? 'insufficient_gems' : 'insufficient_coins' };
    const nextBalance = balance - cost;
    const transaction = { id, currencyType, type: 'spend', source: String(source || 'system'), amount: -cost, balanceAfter: nextBalance, metadata: metadataFor(metadata, id), createdAt: Date.now() };
    const saved = append(current, transaction, currencyType, nextBalance, current.statistics || {});
    core().DataProvider?.recordTransaction?.(transaction);
    emit(spendEvent(currencyType), source, { currencyType, [currencyType]: cost, amount: cost, balance: saved[currencyType], transactionId: id, metadata: transaction.metadata });
    return { ok: true, spent: cost, balance: Number(saved[currencyType] || nextBalance), transaction };
  };

  const CurrencyManager = {
    getBalance() { return this.getCoins(); },
    getCoins() { return balanceOf(player()?.get?.(), 'coins'); },
    getGems() { return balanceOf(player()?.get?.(), 'gems'); },
    canSpend(amount) { return this.canSpendCoins(amount); },
    canSpendCoins(amount) { return this.getCoins() >= integer(amount); },
    canSpendGems(amount) { return this.getGems() >= integer(amount); },
    getTransactions(currencyType = null) { const history = currencyType ? transactions().filter(item => normalizeCurrency(item.currencyType) === normalizeCurrency(currencyType)) : transactions(); return clone(history); },
    addCoins(amount, source = 'system', metadata = {}) { return add(amount, 'coins', source, metadata); },
    addGems(amount, source = 'system', metadata = {}) { return add(amount, 'gems', source, metadata); },
    spendCoins(amount, source = 'system', metadata = {}) { return spend(amount, 'coins', source, metadata); },
    spendGems(amount, source = 'system', metadata = {}) { return spend(amount, 'gems', source, metadata); }
  };

  window.TelePlayCore ??= {};
  window.TelePlayCore.CurrencyManager = CurrencyManager;
})();
