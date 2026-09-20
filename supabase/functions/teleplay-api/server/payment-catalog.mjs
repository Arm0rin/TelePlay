/*
 * Server-owned Telegram payment packages.
 * Prices are configured through TELEPLAY_PAYMENT_PACKAGES; no real price is
 * enabled in source control.
 */
const DRAFT_PACKAGES = Object.freeze([
  { id: 'gem-pack-small', name: 'Small Pack', description: '100 TeleGems', gemsAmount: 100, bonus: 0, amount: null, starsPrice: null, currency: 'XTR', provider: 'telegram_stars', enabled: false, active: false },
  { id: 'gem-pack-medium', name: 'Medium Pack', description: '500 TeleGems', gemsAmount: 500, bonus: 0, amount: null, starsPrice: null, currency: 'XTR', provider: 'telegram_stars', enabled: false, active: false },
  { id: 'gem-pack-large', name: 'Large Pack', description: '1200 TeleGems', gemsAmount: 1200, bonus: 0, amount: null, starsPrice: null, currency: 'XTR', provider: 'telegram_stars', enabled: false, active: false },
  { id: 'gem-pack-mega', name: 'Mega Pack', description: '3000 TeleGems', gemsAmount: 3000, bonus: 0, amount: null, starsPrice: null, currency: 'XTR', provider: 'telegram_stars', enabled: false, active: false }
]);
const safeText = (value, max) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const positiveInteger = value => Number.isInteger(Number(value)) && Number(value) > 0 ? Number(value) : null;
const nonNegativeInteger = value => Number.isInteger(Number(value)) && Number(value) >= 0 ? Number(value) : 0;
const normalize = entry => {
  const value = entry && typeof entry === 'object' ? entry : {}, id = safeText(value.id, 64), name = safeText(value.name, 32), description = safeText(value.description || value.name, 255), gemsAmount = positiveInteger(value.gemsAmount), amount = positiveInteger(value.amount ?? value.starsPrice), bonus = nonNegativeInteger(value.bonus), active = value.active === undefined ? value.enabled !== false : value.active === true, currency = safeText(value.currency || 'XTR', 3).toUpperCase();
  if (!id || !name || !description || !gemsAmount || !amount || !/^[A-Z]{3}$/.test(currency)) return null;
  return { id, name, description, gemsAmount, bonus, amount, starsPrice: amount, currency, provider: safeText(value.provider || (currency === 'XTR' ? 'telegram_stars' : 'telegram'), 64) || 'telegram', enabled: active, active };
};
export const paymentPackages = env => { const raw = String(env?.TELEPLAY_PAYMENT_PACKAGES || '').trim(); if (!raw) return [...DRAFT_PACKAGES]; try { const parsed = JSON.parse(raw), list = Array.isArray(parsed) ? parsed : Object.values(parsed || {}); return list.map(normalize).filter(Boolean); } catch (_) { return []; } };
export const paymentPackage = (env, packageId) => paymentPackages(env).find(item => item.id === String(packageId || '').trim()) || null;
export const configuredPaymentPackages = env => paymentPackages(env).filter(item => item.enabled);
