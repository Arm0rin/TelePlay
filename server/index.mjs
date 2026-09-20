import { SHOP_CATALOG } from './shop-catalog.mjs';
import { configuredPaymentPackages, paymentPackage } from './payment-catalog.mjs';

/*
 * TelePlay backend API
 *
 * This module targets a Web Fetch runtime (Cloudflare Worker, Deno Deploy or
 * another serverless adapter) with a SQLite/D1-compatible `env.DB` binding.
 * It deliberately contains no client secrets. The bot token and owner list
 * are runtime secrets only.
 */

const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
const MAX_INIT_DATA_AGE = 24 * 60 * 60;
const MAX_BODY_BYTES = 128 * 1024;
const MAX_TRANSACTION_AMOUNT = 1_000_000;
const MAX_TRANSACTION_ID_LENGTH = 128;
const MAX_SOURCE_LENGTH = 64;
const MAX_GAME_SCORE = 100_000;
const MAX_GAME_DURATION = 24 * 60 * 60 * 1000;
const MAX_SESSION_AGE = 7 * 24 * 60 * 60 * 1000;
const MAX_FUTURE_SKEW = 5 * 60 * 1000;
const MAX_EVENT_LENGTH = 128;
const MAX_METADATA_BYTES = 16 * 1024;
const MAX_EVENTS_PER_MINUTE = 120;
const MAX_SESSIONS_PER_MINUTE = 30;
const MAX_REWARD_RESULTS_PER_MINUTE = 10;
const MAX_REWARD_RESULTS_PER_HOUR = 100;
const MAX_RESULT_TIMESTAMP_SKEW = 5 * 60 * 1000;
const MAX_PAYMENT_AMOUNT = 1_000_000_000;
const MAX_PAYMENT_GEMS = 10_000_000;
const MAX_PAYMENT_HISTORY = 500;
const PAYMENT_WEBHOOK_SECRET_HEADER = 'X-Telegram-Bot-Api-Secret-Token';
const LOCAL_MIGRATION_VERSION = 'local-v1';
const MAX_MIGRATION_ITEMS = 500;
const MAX_MIGRATION_ACHIEVEMENTS = 1000;
const MAX_MIGRATION_STAT = 10_000_000;
const MAX_MIGRATION_SCORE = 100_000;
const ALLOWED_EARN_SOURCES = new Set(['game', 'reward', 'challenge', 'daily_challenge', 'weekly_challenge', 'achievement', 'streak', 'legacy_reward', 'admin_action', 'payment', 'system']);
const ALLOWED_SPEND_SOURCES = new Set(['shop', 'garage', 'admin_action', 'system']);
const KNOWN_GAME_IDS = new Set(['neon-race', 'block-grid', 'beat-dash', 'neon-hook', 'penalty-duel']);

// Reward rules are deliberately server-only. The client may report a result,
// but it never supplies the amount of currency or XP to mint.
const REWARD_RULES = Object.freeze({
  'neon-race': { maxScore: 100000, maxScorePerSecond: 5000, minDuration: 250, calculate: ({ score, result }) => ({ coins: Math.min(60, Math.floor(Number(result.distance || score) / 40)), xp: Math.min(120, Math.floor(score / 100)) }) },
  'block-grid': { maxScore: 100000, maxScorePerSecond: 5000, minDuration: 250, calculate: ({ score }) => ({ coins: Math.min(50, Math.floor(score / 500)), xp: Math.min(120, Math.floor(score / 20)) }) },
  'beat-dash': { maxScore: 100000, maxScorePerSecond: 5000, minDuration: 250, calculate: ({ score, result }) => ({ coins: Math.min(50, Math.floor(Number(result.progress || 0) / 10)), xp: Math.min(120, Math.floor(score / 25)) }) },
  'neon-hook': { maxScore: 100000, maxScorePerSecond: 5000, minDuration: 250, calculate: ({ score, result }) => ({ coins: Math.min(60, Math.floor(score / 100) + (result.completed ? 5 : 0)), xp: Math.min(160, Math.floor(score / 40)) }) },
  'penalty-duel': { maxScore: 100000, maxScorePerSecond: 5000, minDuration: 250, calculate: ({ score, result }) => ({ coins: Math.min(50, Math.max(0, Math.floor(Number(result.goals || 0) * 2))), xp: Math.min(150, Math.max(0, Math.floor(Number(result.goals || 0) * 20))) }) }
});

const clone = value => JSON.parse(JSON.stringify(value ?? {}));
const parseJson = (value, fallback) => {
  try { if (value == null || value === '') return fallback; return typeof value === 'string' ? JSON.parse(value) : clone(value); } catch (_) { return fallback; }
};
const integer = (value, minimum = 0) => Math.max(minimum, Math.floor(Number(value) || 0));
const boundedInteger = (value, maximum, minimum = 0) => Math.min(maximum, integer(value, minimum));
const id = prefix => `${prefix}:${Date.now()}:${crypto.randomUUID?.() || Math.random().toString(36).slice(2)}`;
const encodedSize = value => {
  try { return new TextEncoder().encode(JSON.stringify(value ?? {})).byteLength; } catch (_) { return Number.POSITIVE_INFINITY; }
};
const affectedRows = result => Number(result?.changes ?? result?.count ?? result?.rowCount ?? result?.length ?? 0);

class HttpError extends Error {
  constructor(status, code, message = code, details = {}) { super(message); this.status = status; this.code = code; this.details = details; }
}

const json = (body, status = 200, extra = {}) => new Response(JSON.stringify(body), { status, headers: { ...JSON_HEADERS, ...extra } });
const empty = (status, extra = {}) => new Response(null, { status, headers: { ...JSON_HEADERS, ...extra } });
const dbOf = env => env?.DB || env?.db;
const stmt = (db, sql, args = []) => db.prepare(sql).bind(...args);
const first = async (db, sql, args = []) => db ? stmt(db, sql, args).first() : null;
const all = async (db, sql, args = []) => {
  if (!db) return [];
  const result = await stmt(db, sql, args).all();
  return result?.results || [];
};
const run = async (db, sql, args = []) => {
  if (!db) throw new HttpError(503, 'database_not_configured', 'Database binding env.DB is not configured');
  return stmt(db, sql, args).run();
};
const requireDb = env => { const db = dbOf(env); if (!db) throw new HttpError(503, 'database_not_configured', 'Database binding env.DB is not configured'); return db; };

async function hmac(keyBytes, messageBytes) {
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, messageBytes));
}

const hex = bytes => Array.from(bytes).map(value => value.toString(16).padStart(2, '0')).join('');
const equalHex = (left, right) => {
  if (!left || !right || left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return mismatch === 0;
};

/** Validate Telegram WebApp initData using the bot token kept on the server. */
export async function verifyTelegramInitData(raw, botToken, maxAge = MAX_INIT_DATA_AGE) {
  if (!raw || !botToken) throw new HttpError(401, 'telegram_auth_required', 'Telegram initData is required');
  const values = new URLSearchParams(raw);
  const receivedHash = values.get('hash');
  const authDate = Number(values.get('auth_date') || 0);
  if (!receivedHash || !authDate || (Date.now() / 1000) - authDate > maxAge || authDate - (Date.now() / 1000) > 60) {
    throw new HttpError(401, 'telegram_auth_expired', 'Telegram initData is expired or incomplete');
  }
  const checkString = [...values.entries()]
    .filter(([key]) => key !== 'hash')
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  const encoder = new TextEncoder();
  // Telegram Web Apps derive the secret as HMAC(key="WebAppData", msg=botToken).
  const secret = await hmac(encoder.encode('WebAppData'), encoder.encode(botToken));
  const calculatedHash = hex(await hmac(secret, encoder.encode(checkString)));
  if (!equalHex(calculatedHash, receivedHash.toLowerCase())) throw new HttpError(401, 'telegram_auth_invalid', 'Telegram initData signature is invalid');
  let user;
  try { user = JSON.parse(values.get('user') || '{}'); } catch (_) { throw new HttpError(401, 'telegram_user_invalid', 'Telegram user payload is invalid'); }
  if (!user?.id) throw new HttpError(401, 'telegram_user_missing', 'Telegram user id is missing');
  return { telegramId: String(user.id), user, authDate };
}

const readBody = async request => {
  const declaredLength = Number(request.headers.get('Content-Length') || 0);
  if (declaredLength > MAX_BODY_BYTES) throw new HttpError(413, 'request_too_large', 'Request body is too large');
  let raw;
  try { raw = await request.text(); } catch (_) { throw new HttpError(400, 'invalid_json', 'Request body must be valid JSON'); }
  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) throw new HttpError(413, 'request_too_large', 'Request body is too large');
  let parsed;
  try { parsed = raw ? JSON.parse(raw) : {}; } catch (_) { throw new HttpError(400, 'invalid_json', 'Request body must be valid JSON'); }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new HttpError(400, 'invalid_body', 'Request body must be a JSON object');
  return parsed;
};

const originHeaders = (request, env) => {
  const requested = request.headers.get('Origin') || '';
  const configured = String(env?.TELEPLAY_WEB_ORIGIN || env?.WEB_ORIGIN || '').trim();
  const allowOrigin = configured || requested || 'null';
  const allowed = !configured || requested === configured;
  return { 'Access-Control-Allow-Origin': allowed ? allowOrigin : 'null', 'Access-Control-Allow-Headers': 'Content-Type, X-Telegram-Init-Data, X-Request-Id, X-Idempotency-Key', 'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS', Vary: 'Origin' };
};

async function authenticate(request, env) {
  const raw = request.headers.get('X-Telegram-Init-Data') || '';
  return verifyTelegramInitData(raw, env?.TELEGRAM_BOT_TOKEN, integer(env?.TELEPLAY_INIT_DATA_MAX_AGE || MAX_INIT_DATA_AGE, 60));
}

const ownerIds = env => new Set(String(env?.TELEPLAY_OWNER_IDS || env?.TELEPLAY_OWNER_ID || env?.OWNER_ID || '').split(',').map(value => value.trim()).filter(Boolean));
const requireOwner = async (request, env) => {
  const identity = await authenticate(request, env);
  if (!ownerIds(env).has(identity.telegramId)) throw new HttpError(403, 'admin_forbidden', 'Owner permission is required');
  return { ...identity, role: 'owner' };
};

const playerSelect = `
  SELECT p.telegram_id, p.username, p.first_name, p.avatar, p.created_at, p.last_active,
         p.records_json, p.statistics_json, p.state_json,
         pr.level, pr.xp, pr.total_xp, pr.rank, pr.streak_json, pr.achievements_json,
         pr.mastery_json, pr.titles_json, pr.challenges_json,
         e.coins, e.gems, i.profile_json, i.games_json,
         (SELECT m.id FROM player_migrations m WHERE m.player_id = p.telegram_id ORDER BY m.completed_at DESC LIMIT 1) AS migration_id,
         (SELECT m.migration_version FROM player_migrations m WHERE m.player_id = p.telegram_id ORDER BY m.completed_at DESC LIMIT 1) AS migration_version,
         (SELECT m.source FROM player_migrations m WHERE m.player_id = p.telegram_id ORDER BY m.completed_at DESC LIMIT 1) AS migration_source,
         (SELECT m.completed_at FROM player_migrations m WHERE m.player_id = p.telegram_id ORDER BY m.completed_at DESC LIMIT 1) AS migration_completed_at
  FROM players p
  LEFT JOIN progress pr ON pr.player_id = p.telegram_id
  LEFT JOIN economy e ON e.player_id = p.telegram_id
  LEFT JOIN inventory i ON i.player_id = p.telegram_id`;

const serializePlayer = row => {
  if (!row) return null;
  const achievements = parseJson(row.achievements_json, []);
  const profileInventory = parseJson(row.profile_json, {});
  const gameInventory = parseJson(row.games_json, {});
  const savedState = parseJson(row.state_json, {});
  return {
    telegramId: String(row.telegram_id),
    username: row.username || '',
    firstName: row.first_name || '',
    avatar: row.avatar || '',
    createdAt: Number(row.created_at || 0),
    lastActive: Number(row.last_active || 0),
    account: { provider: 'telegram', source: 'telegram_registration', telegramId: String(row.telegram_id), createdAt: Number(row.created_at || 0) },
    migration: row.migration_id ? { completed: true, required: false, status: 'completed', id: row.migration_id, version: row.migration_version || LOCAL_MIGRATION_VERSION, source: row.migration_source || 'localStorage', completedAt: Number(row.migration_completed_at || 0) } : { completed: false, required: false, status: 'not_required', version: null, source: null, completedAt: null },
    profile: { id: String(row.telegram_id), username: row.username || '', firstName: row.first_name || '', avatar: row.avatar || '', createdAt: Number(row.created_at || 0) },
    progress: { level: integer(row.level || 1, 1), xp: integer(row.xp), totalXP: integer(row.total_xp ?? row.xp), rank: row.rank || 'rookie', achievements, streak: parseJson(row.streak_json, {}) },
    economy: { coins: integer(row.coins), gems: integer(row.gems) },
    inventory: { profile: profileInventory, games: gameInventory, profileItems: Array.isArray(profileInventory.ownedItems) ? profileInventory.ownedItems : [], gameItems: gameInventory },
    statistics: { ...parseJson(row.statistics_json, {}), sessions: integer(parseJson(row.statistics_json, {})?.totalGames || 0) },
    records: parseJson(row.records_json, {}),
    mastery: parseJson(row.mastery_json, {}),
    titles: parseJson(row.titles_json, {}),
    challenges: parseJson(row.challenges_json, {}),
    state: savedState
  };
};

const playerRow = async (db, telegramId) => first(db, `${playerSelect} WHERE p.telegram_id = ?`, [String(telegramId)]);
const player = async (db, telegramId) => serializePlayer(await playerRow(db, telegramId));

async function createSnapshot(db, record, identity) {
  const now = Date.now();
  const telegramId = String(identity?.telegramId || record?.telegramId || '');
  if (!telegramId) throw new HttpError(400, 'player_id_missing', 'telegramId is required');
  const existing = await playerRow(db, telegramId);
  if (existing) return { player: serializePlayer(existing), imported: false };
  // A first request may be a migration from localStorage, but that snapshot
  // is untrusted client input.  Currency, progression, achievements, records
  // and owned items therefore always start from server defaults.  Owner/admin
  // actions are the only supported way to seed authoritative values.
  const profile = record?.profile || {};
  const savedState = record?.state || {};
  const safeState = {
    settings: clone(savedState.settings || {}),
    activity: clone(savedState.activity || {}),
    favoriteGameId: typeof savedState.favoriteGameId === 'string' ? savedState.favoriteGameId.slice(0, 64) : null
  };
  const createdAt = now;
  await db.batch([
    stmt(db, `INSERT INTO players (telegram_id, username, first_name, avatar, created_at, last_active, records_json, statistics_json, state_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [telegramId, String(identity?.user?.username || profile.username || '').slice(0, 64), String(identity?.user?.first_name || profile.firstName || '').slice(0, 128), String(identity?.user?.photo_url || profile.avatar || '').slice(0, 2048), createdAt, now, '{}', '{}', JSON.stringify(safeState)]),
    stmt(db, `INSERT INTO progress (player_id, level, xp, total_xp, rank, streak_json, achievements_json, mastery_json, titles_json, challenges_json, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [telegramId, 1, 0, 0, 'rookie', '{}', '[]', '{}', '{}', '{}', now]),
    stmt(db, `INSERT INTO economy (player_id, coins, gems, updated_at) VALUES (?, ?, ?, ?)`, [telegramId, 0, 0, now]),
    stmt(db, `INSERT INTO inventory (player_id, profile_json, games_json, updated_at) VALUES (?, ?, ?, ?)`, [telegramId, JSON.stringify({ ownedItems: ['avatar-frame-neon'], equippedItems: { avatarFrame: 'avatar-frame-neon' }, purchaseHistory: [] }), '{}', now])
  ]);
  return { player: await player(db, telegramId), imported: true };
}

const safeString = (value, length = 128) => typeof value === 'string' ? value.slice(0, length) : '';
const safeStringList = (value, max = MAX_MIGRATION_ACHIEVEMENTS, length = 128) => Array.from(new Set((Array.isArray(value) ? value : []).map(item => typeof item === 'object' ? item?.id : item).filter(Boolean).map(item => safeString(String(item), length)))).slice(0, max);
const safeObject = (value, maxKeys = 100) => {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return Object.fromEntries(Object.entries(source).slice(0, maxKeys).map(([key, entry]) => [safeString(key, 64), typeof entry === 'object' ? clone(entry) : entry]));
};
const migrationHasData = record => {
  const value = record || {}, progress = value.progress || {}, stats = value.statistics || {}, inventory = value.inventory || {};
  const profileItems = inventory.profile?.ownedItems || inventory.profileItems || [];
  const gameItems = Object.values(inventory.games || inventory.gameItems || {}).some(scope => (scope?.ownedItems || []).length > 0);
  return Number(progress.level || 1) > 1 || Number(progress.xp || progress.totalXP || 0) > 0 || Number(stats.totalGames || stats.gamesPlayed || stats.sessions || 0) > 0 || Object.keys(value.records || {}).length > 0 || safeStringList(progress.achievements || value.achievements, 100).length > 0 || profileItems.some(item => String(item) !== 'avatar-frame-neon') || gameItems;
};
const normalizeLegacyInventory = incoming => {
  const source = incoming || {}, known = itemId => Boolean(SHOP_CATALOG[String(itemId)]), normalize = (scope, gameId = null) => {
    const value = scope && typeof scope === 'object' ? scope : {};
    const ownedItems = Array.from(new Set((Array.isArray(value.ownedItems) ? value.ownedItems : []).map(String).filter(itemId => known(itemId) && (!gameId || SHOP_CATALOG[itemId]?.gameId === gameId)).slice(0, MAX_MIGRATION_ITEMS)));
    const equippedItems = Object.fromEntries(Object.entries(value.equippedItems || {}).filter(([, itemId]) => ownedItems.includes(String(itemId))).slice(0, 32).map(([slot, itemId]) => [safeString(slot, 64), String(itemId)]));
    const purchaseHistory = (Array.isArray(value.purchaseHistory) ? value.purchaseHistory : []).filter(item => ownedItems.includes(String(item?.itemId || ''))).slice(-MAX_MIGRATION_ITEMS).map(item => ({ itemId: String(item.itemId), purchasedAt: integer(item.purchasedAt || 0), scope: gameId ? 'game' : 'profile', gameId: gameId || null, transactionId: null }));
    return { ownedItems, equippedItems, purchaseHistory };
  };
  const profile = normalize(source.profile || { ownedItems: source.profileItems || [] });
  const games = {};
  const gameScopes = source.games || source.gameItems || {};
  for (const [gameId, scope] of Object.entries(gameScopes)) if (KNOWN_GAME_IDS.has(gameId)) games[gameId] = normalize(scope, gameId);
  if (!profile.ownedItems.includes('avatar-frame-neon')) profile.ownedItems.unshift('avatar-frame-neon');
  return { profile, games };
};
const normalizeLegacyMigration = record => {
  const value = record || {}, sourceProgress = value.progress || {}, sourceStats = value.statistics || {}, sourceState = value.state || {}, sourceStreak = sourceProgress.streak || value.progression?.challenges?.streak || {};
  const level = boundedInteger(sourceProgress.level, 100, 1), xp = boundedInteger(sourceProgress.xp ?? sourceProgress.totalXP, 100000000), totalXP = Math.max(xp, boundedInteger(sourceProgress.totalXP ?? sourceProgress.xp, 100000000));
  const progress = { level, xp, totalXP, rank: safeString(sourceProgress.rank || sourceProgress.rankId || 'rookie', 64) || 'rookie', streak: { currentStreak: boundedInteger(sourceStreak.currentStreak, MAX_MIGRATION_STAT), bestStreak: boundedInteger(sourceStreak.bestStreak, MAX_MIGRATION_STAT), lastActiveDate: safeString(sourceStreak.lastActiveDate, 32) || null }, achievements: safeStringList(sourceProgress.achievements || value.achievements?.unlockedAchievements, MAX_MIGRATION_ACHIEVEMENTS) };
  const statistics = safeObject(sourceStats, 64);
  statistics.totalGames = boundedInteger(sourceStats.totalGames ?? sourceStats.gamesPlayed ?? sourceStats.sessions, MAX_MIGRATION_STAT);
  statistics.gamesPlayed = boundedInteger(sourceStats.gamesPlayed ?? sourceStats.totalGames, MAX_MIGRATION_STAT);
  statistics.totalScore = boundedInteger(sourceStats.totalScore, Number.MAX_SAFE_INTEGER);
  statistics.totalPlayTime = boundedInteger(sourceStats.totalPlayTime, Number.MAX_SAFE_INTEGER);
  statistics.launchesByGame = Object.fromEntries(Object.entries(sourceStats.launchesByGame || {}).filter(([gameId]) => KNOWN_GAME_IDS.has(gameId)).slice(0, 32).map(([gameId, count]) => [gameId, boundedInteger(count, MAX_MIGRATION_STAT)]));
  const records = Object.fromEntries(Object.entries(value.records || {}).filter(([gameId]) => KNOWN_GAME_IDS.has(gameId)).slice(0, 32).map(([gameId, entry]) => [gameId, { ...safeObject(entry, 32), bestScore: boundedInteger(entry?.bestScore, MAX_MIGRATION_SCORE), lastScore: boundedInteger(entry?.lastScore, MAX_MIGRATION_SCORE), gamesPlayed: boundedInteger(entry?.gamesPlayed, MAX_MIGRATION_STAT) }]));
  const safeState = { settings: safeObject(sourceState.settings, 64), activity: safeObject(sourceState.activity, 32), favoriteGameId: KNOWN_GAME_IDS.has(String(sourceState.favoriteGameId || '')) ? String(sourceState.favoriteGameId) : null };
  return { progress, statistics, records, inventory: normalizeLegacyInventory(value.inventory || {}), state: safeState, economyPolicy: 'server-defaults' };
};

async function importLocalSnapshot(db, identity, record) {
  const telegramId = String(identity.telegramId), current = await playerRow(db, telegramId);
  if (!current) await createSnapshot(db, {}, identity);
  const existingMigration = await first(db, `SELECT id, migration_version, source, completed_at, metadata_json FROM player_migrations WHERE player_id = ? AND migration_version = ?`, [telegramId, LOCAL_MIGRATION_VERSION]);
  const currentPlayer = await player(db, telegramId);
  if (existingMigration || !migrationHasData(record)) return { player: currentPlayer, imported: false, migrationCompleted: Boolean(existingMigration), migrationRequired: false, migration: existingMigration ? { completed: true, required: false, status: 'completed', id: existingMigration.id, version: existingMigration.migration_version, source: existingMigration.source, completedAt: Number(existingMigration.completed_at || 0) } : currentPlayer?.migration };
  const safe = normalizeLegacyMigration(record), completedAt = Date.now(), migrationId = `migration:${telegramId}:${LOCAL_MIGRATION_VERSION}`;
  const metadata = { migrationId: String(record?.migrationId || '').slice(0, 128) || null, version: LOCAL_MIGRATION_VERSION, source: 'localStorage', economyPolicy: safe.economyPolicy, economyImported: false };
  await db.batch([
    stmt(db, `UPDATE players SET records_json = ?, statistics_json = ?, state_json = ?, last_active = ? WHERE telegram_id = ?`, [JSON.stringify(safe.records), JSON.stringify(safe.statistics), JSON.stringify(safe.state), completedAt, telegramId]),
    stmt(db, `UPDATE progress SET level = ?, xp = ?, total_xp = ?, rank = ?, streak_json = ?, achievements_json = ?, updated_at = ? WHERE player_id = ?`, [safe.progress.level, safe.progress.xp, safe.progress.totalXP, safe.progress.rank, JSON.stringify(safe.progress.streak), JSON.stringify(safe.progress.achievements), completedAt, telegramId]),
    stmt(db, `UPDATE inventory SET profile_json = ?, games_json = ?, updated_at = ? WHERE player_id = ?`, [JSON.stringify(safe.inventory.profile), JSON.stringify(safe.inventory.games), completedAt, telegramId]),
    stmt(db, `INSERT INTO player_migrations (id, player_id, migration_version, source, completed_at, metadata_json) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT (player_id, migration_version) DO NOTHING`, [migrationId, telegramId, LOCAL_MIGRATION_VERSION, 'localStorage', completedAt, JSON.stringify(metadata)])
  ]);
  const migration = await first(db, `SELECT id, migration_version, source, completed_at FROM player_migrations WHERE player_id = ? AND migration_version = ?`, [telegramId, LOCAL_MIGRATION_VERSION]);
  return { player: await player(db, telegramId), imported: Boolean(migration), migrationCompleted: Boolean(migration), migrationRequired: false, migration: { completed: Boolean(migration), required: false, status: 'completed', id: migration?.id || migrationId, version: migration?.migration_version || LOCAL_MIGRATION_VERSION, source: migration?.source || 'localStorage', completedAt: Number(migration?.completed_at || completedAt) } };
}

async function requirePlayer(db, telegramId) {
  const value = await player(db, telegramId);
  if (!value) throw new HttpError(404, 'player_not_found', 'Player does not exist');
  return value;
}

const normalizeInventoryScope = scope => {
  const value = scope && typeof scope === 'object' ? scope : {};
  return {
    ownedItems: Array.from(new Set((Array.isArray(value.ownedItems) ? value.ownedItems : []).map(String).filter(Boolean))).slice(0, 500),
    equippedItems: Object.fromEntries(Object.entries(value.equippedItems || {}).map(([slot, itemId]) => [String(slot), String(itemId)]).filter(([, itemId]) => itemId)),
    purchaseHistory: (Array.isArray(value.purchaseHistory) ? value.purchaseHistory : []).slice(-500).map(entry => ({
      itemId: String(entry?.itemId || '').slice(0, 128),
      transactionId: entry?.transactionId ? String(entry.transactionId).slice(0, MAX_TRANSACTION_ID_LENGTH) : null,
      purchasedAt: integer(entry?.purchasedAt || 0),
      scope: entry?.scope === 'game' ? 'game' : 'profile',
      gameId: entry?.gameId ? String(entry.gameId).slice(0, 64) : null
    })).filter(entry => entry.itemId)
  };
};

async function verifiedInventory(db, playerId, incoming) {
  const currentRow = await first(db, `SELECT profile_json, games_json FROM inventory WHERE player_id = ?`, [playerId]);
  const currentProfile = normalizeInventoryScope(parseJson(currentRow?.profile_json, {})), currentGames = parseJson(currentRow?.games_json, {});
  const transactions = await all(db, `SELECT source, metadata_json FROM transactions WHERE player_id = ? AND type = 'spend' AND (source = 'teleplay-shop' OR source LIKE 'game-shop:%') ORDER BY created_at DESC LIMIT 1000`, [playerId]);
  const purchased = new Set(transactions.map(row => String(parseJson(row.metadata_json, {})?.itemId || '')).filter(Boolean));
  const approveScope = (nextScope, currentScope, gameId = null) => {
    const next = normalizeInventoryScope(nextScope), current = normalizeInventoryScope(currentScope);
    const allowed = new Set([
      ...current.ownedItems,
      ...next.ownedItems.filter(itemId => {
        if (purchased.has(itemId)) return true;
        const catalogItem = SHOP_CATALOG[itemId];
        return catalogItem?.amount === 0 && (gameId ? catalogItem.gameId === gameId : catalogItem.scope === 'profile');
      })
    ]);
    const ownedItems = [...allowed], equippedItems = Object.fromEntries(Object.entries(next.equippedItems).filter(([, itemId]) => allowed.has(itemId)));
    return { ...next, ownedItems, equippedItems };
  };
  const source = incoming || {}, profile = approveScope(source.profile || { ownedItems: source.profileItems || [] }, currentProfile), games = {};
  const nextGames = source.games || source.gameItems || {};
  for (const gameId of new Set([...Object.keys(currentGames), ...Object.keys(nextGames)])) games[gameId] = approveScope(nextGames[gameId], currentGames[gameId], gameId);
  return { profile, games };
}

async function syncPlayerState(db, identity, record) {
  const telegramId = identity.telegramId, now = Date.now(), current = await requirePlayer(db, telegramId), savedState = record?.state || {};
  const inventory = await verifiedInventory(db, telegramId, record?.inventory || {});
  // Progress, achievements, records and statistics are server-owned.  The
  // client may sync presentation state and verified inventory, but cannot
  // write XP/level or inflate scores by sending a forged snapshot.
  const serverProgress = current.progress || {}, serverStatistics = current.statistics || {}, serverRecords = current.records || {};
  const safeProgress = {
    level: boundedInteger(serverProgress.level || 1, 100, 1),
    xp: boundedInteger(serverProgress.xp, 100000000),
    totalXP: boundedInteger(serverProgress.totalXP, 100000000),
    rank: String(serverProgress.rank || 'rookie').slice(0, 64),
    streak: clone(serverProgress.streak || {}),
    achievements: Array.isArray(serverProgress.achievements) ? serverProgress.achievements.map(String).slice(0, 1000) : []
  };
  const safeState = {
    settings: clone(savedState.settings || {}),
    activity: clone(savedState.activity || {}),
    favoriteGameId: KNOWN_GAME_IDS.has(String(savedState.favoriteGameId || '')) ? String(savedState.favoriteGameId) : null
  };
  await db.batch([
    stmt(db, `UPDATE players SET username = ?, first_name = ?, avatar = ?, last_active = ?, records_json = ?, statistics_json = ?, state_json = ? WHERE telegram_id = ?`, [String(identity.user?.username || current.username || '').slice(0, 64), String(identity.user?.first_name || current.firstName || '').slice(0, 128), String(identity.user?.photo_url || current.avatar || '').slice(0, 2048), now, JSON.stringify(serverRecords), JSON.stringify(serverStatistics), JSON.stringify(safeState), telegramId]),
    stmt(db, `UPDATE progress SET level = ?, xp = ?, total_xp = ?, rank = ?, streak_json = ?, achievements_json = ?, mastery_json = ?, titles_json = ?, challenges_json = ?, updated_at = ? WHERE player_id = ?`, [safeProgress.level, safeProgress.xp, safeProgress.totalXP, safeProgress.rank, JSON.stringify(safeProgress.streak), JSON.stringify(safeProgress.achievements), JSON.stringify(current.mastery || {}), JSON.stringify(current.titles || {}), JSON.stringify(current.challenges || {}), now, telegramId]),
    stmt(db, `UPDATE inventory SET profile_json = ?, games_json = ?, updated_at = ? WHERE player_id = ?`, [JSON.stringify(inventory.profile), JSON.stringify(inventory.games), now, telegramId])
  ]);
  return player(db, telegramId);
}

async function transactionById(db, transactionId, playerId = null) {
  return first(db, `SELECT id, player_id, currency_type, type, amount, balance_after, source, metadata_json, created_at FROM transactions WHERE id = ?${playerId == null ? '' : ' AND player_id = ?'}`, playerId == null ? [transactionId] : [transactionId, playerId]);
}

const serializeTransaction = row => row ? ({ id: row.id, playerId: String(row.player_id), currencyType: row.currency_type, currency: row.currency_type, type: row.type, amount: Number(row.amount || 0), balanceAfter: Number(row.balance_after || 0), source: row.source, metadata: parseJson(row.metadata_json, {}), createdAt: Number(row.created_at || 0) }) : null;

const serializePayment = row => row ? ({
  id: String(row.id), playerId: String(row.player_id), packageId: row.package_id,
  invoiceId: row.invoice_id, invoicePayload: row.invoice_payload, invoiceUrl: row.invoice_link,
  paymentProvider: row.payment_provider, amount: Number(row.amount || 0), currency: row.currency,
  status: row.status, gemsAmount: Number(row.gems_amount || 0),
  telegramPaymentChargeId: row.telegram_payment_charge_id || null,
  providerPaymentChargeId: row.provider_payment_charge_id || null,
  idempotencyKey: row.idempotency_key || null, metadata: parseJson(row.metadata_json, {}),
  createdAt: Number(row.created_at || 0), completedAt: row.completed_at == null ? null : Number(row.completed_at),
  updatedAt: row.updated_at == null ? null : Number(row.updated_at)
}) : null;

const paymentSelect = `SELECT id, player_id, package_id, invoice_id, invoice_payload, invoice_link, payment_provider, amount, currency, status, gems_amount, telegram_payment_charge_id, provider_payment_charge_id, idempotency_key, metadata_json, created_at, completed_at, updated_at FROM payments`;
const paymentById = (db, paymentId) => first(db, `${paymentSelect} WHERE id = ?`, [paymentId]);
const paymentByPayload = (db, payload) => first(db, `${paymentSelect} WHERE invoice_payload = ?`, [payload]);
const paymentByIdempotency = (db, playerId, key) => first(db, `${paymentSelect} WHERE player_id = ? AND idempotency_key = ?`, [playerId, key]);

async function paymentAnalytics(db, playerId, event, metadata = {}, eventKey = '') {
  const eventId = `payment-event:${eventKey || id('event')}:${event}`;
  const payload = { ...clone(metadata), playerId, timestamp: Date.now() };
  await run(db, `INSERT INTO analytics_events (id, player_id, event, metadata_json, created_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT (id) DO NOTHING`, [eventId, playerId, event, JSON.stringify(payload), payload.timestamp]);
}

async function telegramPaymentApi(env, method, payload) {
  const token = String(env?.TELEGRAM_BOT_TOKEN || '').trim();
  if (!token) throw new HttpError(503, 'telegram_payments_not_configured', 'Telegram Payments are not configured');
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  let data = null;
  try { data = await response.json(); } catch (_) { data = null; }
  if (!response.ok || !data?.ok) throw new HttpError(502, 'telegram_payment_api_error', 'Telegram payment API rejected the request', { method, description: data?.description || null });
  return data.result;
}

const totalGemsForPackage = pkg => Number(pkg.gemsAmount || 0) + Number(pkg.bonus || 0);
const paymentPackagesForClient = env => configuredPaymentPackages(env).map(pkg => ({ id: pkg.id, name: pkg.name, description: pkg.description, gemsAmount: pkg.gemsAmount, bonus: pkg.bonus, totalGems: totalGemsForPackage(pkg), amount: pkg.amount, currency: pkg.currency, provider: pkg.provider }));

async function createPaymentInvoice(db, env, identity, body, idempotencyKey) {
  await requirePlayer(db, identity.telegramId);
  const packageId = String(body.packageId || '').trim();
  if (!packageId) throw new HttpError(400, 'payment_package_required', 'Payment package is required');
  const packageConfig = paymentPackage(env, packageId);
  if (!packageConfig || !packageConfig.enabled || !Number.isInteger(packageConfig.amount) || packageConfig.amount <= 0) throw new HttpError(409, 'payment_package_unavailable', 'Payment package is not configured');
  const totalGems = totalGemsForPackage(packageConfig);
  if (packageConfig.amount > MAX_PAYMENT_AMOUNT || totalGems > MAX_PAYMENT_GEMS) throw new HttpError(409, 'payment_package_invalid', 'Payment package is outside the allowed limits');
  const existing = idempotencyKey ? await paymentByIdempotency(db, identity.telegramId, idempotencyKey) : null;
  if (existing) return { payment: serializePayment(existing), duplicate: true };
  const createdAt = Date.now(), paymentId = id('payment'), invoicePayload = `teleplay:${paymentId}`;
  const providerToken = String(env?.TELEGRAM_PAYMENT_PROVIDER_TOKEN || env?.PAYMENT_PROVIDER_TOKEN || '');
  if (packageConfig.currency !== 'XTR' && !providerToken) throw new HttpError(503, 'payment_provider_not_configured', 'Payment provider token is not configured');
  await run(db, `INSERT INTO payments (id, player_id, package_id, invoice_id, invoice_payload, invoice_link, payment_provider, amount, currency, status, gems_amount, telegram_payment_charge_id, provider_payment_charge_id, idempotency_key, metadata_json, created_at, completed_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, NULL, NULL, ?, ?, ?, NULL, ?)`, [paymentId, identity.telegramId, packageConfig.id, paymentId, invoicePayload, null, packageConfig.provider, packageConfig.amount, packageConfig.currency, totalGems, idempotencyKey || null, JSON.stringify({ packageName: packageConfig.name, baseGemsAmount: packageConfig.gemsAmount, bonus: packageConfig.bonus, totalGems }), createdAt, createdAt]);
  try {
    const invoiceLink = await telegramPaymentApi(env, 'createInvoiceLink', { title: packageConfig.name, description: packageConfig.description, payload: invoicePayload, provider_token: packageConfig.currency === 'XTR' ? '' : providerToken, currency: packageConfig.currency, prices: [{ label: packageConfig.name, amount: packageConfig.amount }] });
    await run(db, `UPDATE payments SET invoice_link = ?, updated_at = ? WHERE id = ?`, [String(invoiceLink), Date.now(), paymentId]);
    await paymentAnalytics(db, identity.telegramId, 'payment_started', { productId: packageConfig.id, amount: packageConfig.amount, currency: packageConfig.currency, gemsAmount: totalGems, baseGemsAmount: packageConfig.gemsAmount, bonus: packageConfig.bonus }, paymentId);
    return { payment: serializePayment(await paymentById(db, paymentId)), invoiceUrl: String(invoiceLink), duplicate: false };
  } catch (error) {
    await run(db, `UPDATE payments SET status = 'failed', metadata_json = ?, updated_at = ? WHERE id = ?`, [JSON.stringify({ packageName: packageConfig.name, error: String(error?.code || error?.message || 'telegram_api_error') }), Date.now(), paymentId]);
    await paymentAnalytics(db, identity.telegramId, 'payment_failed', { productId: packageConfig.id, amount: packageConfig.amount, currency: packageConfig.currency, reason: String(error?.code || 'telegram_api_error') }, paymentId);
    throw error;
  }
}

async function settleSuccessfulPayment(db, update) {
  const payment = await paymentByPayload(db, String(update?.invoice_payload || ''));
  if (!payment) throw new HttpError(404, 'payment_not_found', 'Payment invoice was not found');
  const telegramId = String(update?.telegram_user_id || '');
  if (!telegramId || telegramId !== String(payment.player_id)) throw new HttpError(403, 'payment_player_mismatch', 'Payment user does not match the invoice owner');
  if (String(update.currency || '') !== String(payment.currency) || Number(update.total_amount) !== Number(payment.amount)) throw new HttpError(400, 'payment_amount_mismatch', 'Payment amount does not match the configured package');
  const chargeId = String(update.telegram_payment_charge_id || '').trim();
  if (!chargeId) throw new HttpError(400, 'payment_charge_missing', 'Telegram payment charge id is required');
  if (payment.status === 'completed') return { payment: serializePayment(payment), duplicate: true };
  if (payment.status === 'refunded' || payment.status === 'failed') throw new HttpError(409, 'payment_not_settleable', 'Payment is not in a settleable state');
  // The event is emitted only for a player's first completed payment. The
  // deterministic event key keeps this safe if Telegram retries the webhook
  // or two payments settle concurrently.
  const priorCompleted = await first(db, `SELECT id FROM payments WHERE player_id = ? AND status = 'completed' AND id <> ? LIMIT 1`, [String(payment.player_id), payment.id]);
  const transactionId = `payment:${payment.id}:gems`;
  const applied = await applyTransaction(db, { playerId: String(payment.player_id), transactionId, currencyType: 'gems', type: 'earn', amount: Number(payment.gems_amount), source: 'payment', metadata: { paymentId: payment.id, invoiceId: payment.invoice_id, invoicePayload: payment.invoice_payload, packageId: payment.package_id, telegramPaymentChargeId: chargeId }, trusted: true });
  const completedAt = Date.now();
  await run(db, `UPDATE payments SET status = 'completed', telegram_payment_charge_id = ?, provider_payment_charge_id = ?, completed_at = ?, updated_at = ?, metadata_json = ? WHERE id = ? AND status = 'pending'`, [chargeId, update.provider_payment_charge_id || null, completedAt, completedAt, JSON.stringify({ packageId: payment.package_id, transactionId, duplicateTransaction: Boolean(applied.duplicate) }), payment.id]);
  await paymentAnalytics(db, String(payment.player_id), 'payment_completed', { productId: payment.package_id, amount: Number(payment.amount), currency: payment.currency, gemsAmount: Number(payment.gems_amount), transactionId }, payment.id);
  await paymentAnalytics(db, String(payment.player_id), 'gems_added', { productId: payment.package_id, amount: Number(payment.gems_amount), currency: 'gems', transactionId }, `${payment.id}:gems`);
  if (!priorCompleted) await paymentAnalytics(db, String(payment.player_id), 'first_payment_completed', { productId: payment.package_id, amount: Number(payment.amount), currency: payment.currency, gemsAmount: Number(payment.gems_amount), transactionId }, `first-payment:${payment.player_id}`);
  return { payment: serializePayment(await paymentById(db, payment.id)), transaction: applied.transaction, duplicate: Boolean(applied.duplicate) };
}

async function settleRefundedPayment(db, update) {
  const payment = await paymentByPayload(db, String(update?.invoice_payload || ''));
  if (!payment) throw new HttpError(404, 'payment_not_found', 'Payment invoice was not found');
  if (payment.status === 'refunded') return { payment: serializePayment(payment), duplicate: true };
  await run(db, `UPDATE payments SET status = 'refunded', metadata_json = ?, updated_at = ? WHERE id = ?`, [JSON.stringify({ ...parseJson(payment.metadata_json, {}), refund: clone(update), requiresOwnerReview: true }), Date.now(), payment.id]);
  return { payment: serializePayment(await paymentById(db, payment.id)), duplicate: false, requiresOwnerReview: true };
}

async function itemAlreadyOwned(db, playerId, itemId, scope, gameId) {
  const row = await first(db, `SELECT profile_json, games_json FROM inventory WHERE player_id = ?`, [playerId]);
  const profile = normalizeInventoryScope(parseJson(row?.profile_json, {}));
  const games = parseJson(row?.games_json, {});
  const inventoryScope = scope === 'game' ? normalizeInventoryScope(games?.[gameId]) : profile;
  if (inventoryScope.ownedItems.includes(itemId)) return true;
  const purchases = await all(db, `SELECT source, metadata_json FROM transactions WHERE player_id = ? AND type = 'spend' AND (source = 'teleplay-shop' OR source LIKE 'game-shop:%') ORDER BY created_at DESC LIMIT 1000`, [playerId]);
  return purchases.some(row => {
    const metadata = parseJson(row.metadata_json, {});
    return String(metadata.itemId || '') === itemId && (scope !== 'game' || String(metadata.gameId || gameId) === gameId);
  });
}

async function applyTransaction(db, { playerId, transactionId, currencyType, type, amount, source, metadata = {}, trusted = false }) {
  const idValue = String(transactionId || '').trim();
  if (!idValue || idValue.length > MAX_TRANSACTION_ID_LENGTH) throw new HttpError(400, 'invalid_transaction_id', 'Transaction id is invalid');
  const idempotent = await transactionById(db, idValue, playerId);
  if (idempotent) return { transaction: serializeTransaction(idempotent), duplicate: true };
  const collision = await transactionById(db, idValue);
  if (collision) throw new HttpError(409, 'transaction_id_conflict', 'Transaction id belongs to another player');
  const currency = String(currencyType || '').toLowerCase() === 'gems' ? 'gems' : 'coins';
  const normalizedType = type === 'spend' ? 'spend' : type === 'earn' ? 'earn' : '';
  if (!normalizedType) throw new HttpError(400, 'invalid_transaction_type', 'Transaction type is invalid');
  const value = integer(amount);
  if (!value || value > MAX_TRANSACTION_AMOUNT) throw new HttpError(400, 'invalid_amount', 'Transaction amount is invalid');
  const normalizedSource = String(source || '').trim();
  if (!normalizedSource || normalizedSource.length > MAX_SOURCE_LENGTH) throw new HttpError(400, 'invalid_transaction_source', 'Transaction source is invalid');
  if (encodedSize(metadata) > MAX_METADATA_BYTES) throw new HttpError(413, 'metadata_too_large', 'Transaction metadata is too large');
  // No browser request can mint currency.  Reward earning must be moved to a
  // server-issued proof flow; owner grants use /admin/actions instead.
  if (normalizedType === 'earn' && !trusted) throw new HttpError(403, 'server_reward_required', 'Currency rewards must be authorized by the server');
  const allowed = normalizedType === 'earn' ? ALLOWED_EARN_SOURCES : ALLOWED_SPEND_SOURCES;
  const shopSource = normalizedType === 'spend' && (normalizedSource === 'teleplay-shop' || normalizedSource.startsWith('game-shop:'));
  if (!allowed.has(normalizedSource) && !KNOWN_GAME_IDS.has(normalizedSource) && !shopSource) throw new HttpError(400, 'invalid_transaction_source', 'Transaction source is not allowed');
  if (shopSource) {
    const itemId = String(metadata?.itemId || '').trim();
    const catalogItem = SHOP_CATALOG[itemId];
    if (!catalogItem) throw new HttpError(400, 'invalid_shop_item', 'Shop item is not available');
    const expectedSource = catalogItem.scope === 'game' ? `game-shop:${catalogItem.gameId}` : 'teleplay-shop';
    if (normalizedSource !== expectedSource) throw new HttpError(400, 'invalid_shop_source', 'Shop source does not match item');
    if (catalogItem.amount <= 0 && (catalogItem.currency !== currency || catalogItem.amount !== value)) {
      throw new HttpError(400, 'invalid_shop_price', 'Shop price is invalid');
    }
    if (catalogItem.amount === 0) throw new HttpError(400, 'free_item', 'Free item does not require a currency transaction');
    if (catalogItem.currency !== currency || catalogItem.amount !== value) throw new HttpError(400, 'invalid_shop_price', 'Shop price is invalid');
    if (await itemAlreadyOwned(db, playerId, itemId, catalogItem.scope, catalogItem.gameId)) throw new HttpError(409, 'item_already_owned', 'Shop item is already owned');
  }
  const economy = await first(db, `SELECT coins, gems FROM economy WHERE player_id = ?`, [playerId]);
  if (!economy) throw new HttpError(404, 'player_not_found', 'Player economy does not exist');
  const before = integer(economy[currency]);
  const delta = normalizedType === 'earn' ? value : -value;
  const after = before + delta;
  if (after < 0) throw new HttpError(409, 'insufficient_balance', 'Balance is insufficient');
  const createdAt = Date.now();
  const signedAmount = normalizedType === 'spend' ? -value : value;
  const transaction = { id: idValue, playerId, currencyType: currency, currency, type: normalizedType, amount: signedAmount, balanceAfter: after, source: normalizedSource, metadata: clone(metadata), createdAt };
  try {
    if (db.kind === 'postgres') {
      // One statement makes the compare-and-swap update and ledger insert
      // atomic under concurrent requests on the Supabase pooler.
      const result = await stmt(db, `WITH updated AS (UPDATE economy SET ${currency} = ?, updated_at = ? WHERE player_id = ? AND ${currency} = ? RETURNING player_id) INSERT INTO transactions (id, player_id, currency_type, type, amount, balance_after, source, metadata_json, created_at) SELECT ?, ?, ?, ?, ?, ?, ?, ?, ? FROM updated RETURNING id`, [after, createdAt, playerId, before, idValue, playerId, currency, normalizedType, signedAmount, after, normalizedSource, JSON.stringify(metadata), createdAt]).all();
      if (!result?.results?.length) throw new HttpError(409, 'balance_conflict', 'Balance changed; retry the transaction');
    } else {
      const results = await db.batch([
        stmt(db, `UPDATE economy SET ${currency} = ?, updated_at = ? WHERE player_id = ? AND ${currency} = ?`, [after, createdAt, playerId, before]),
        stmt(db, `INSERT INTO transactions (id, player_id, currency_type, type, amount, balance_after, source, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [idValue, playerId, currency, normalizedType, signedAmount, after, normalizedSource, JSON.stringify(metadata), createdAt])
      ]);
      if (affectedRows(results?.[0]) !== 1) throw new HttpError(409, 'balance_conflict', 'Balance changed; retry the transaction');
    }
  } catch (error) {
    if (shopSource && (String(error?.code || '') === '23505' || /shop_purchase_once|unique/i.test(String(error?.message || '')))) {
      throw new HttpError(409, 'item_already_owned', 'Shop item is already owned');
    }
    throw error;
  }
  return { transaction, duplicate: false };
}

const logAdminAction = async (db, entry) => {
  await run(db, `INSERT INTO admin_actions (id, admin_id, role, target_player_id, action, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT (id) DO NOTHING`, [entry.id, entry.adminId, entry.role || 'owner', entry.targetPlayerId || null, entry.action, JSON.stringify(entry.metadata || entry), integer(entry.timestamp || Date.now())]);
};

async function applyAdminAction(db, identity, body) {
  const actionId = String(body.id || body.actionId || '').trim();
  if (!actionId) throw new HttpError(400, 'action_id_required', 'Admin action id is required');
  if (actionId.length > MAX_TRANSACTION_ID_LENGTH || encodedSize(body.metadata || {}) > MAX_METADATA_BYTES) throw new HttpError(400, 'invalid_admin_action', 'Admin action metadata is invalid');
  const existing = await first(db, `SELECT id, action, target_player_id, created_at FROM admin_actions WHERE id = ?`, [actionId]);
  if (existing) return { ok: true, duplicate: true, action: existing };
  const targetId = String(body.targetPlayerId || body.targetPlayer || '').trim();
  if (!targetId) throw new HttpError(400, 'target_player_required', 'Target player is required');
  await requirePlayer(db, targetId);
  const operation = String(body.operation || '').toLowerCase();
  let result = { ok: true };
  if (operation === 'currency') {
    const amount = Number(body.amount || 0);
    if (!amount) throw new HttpError(400, 'invalid_amount', 'Currency amount is required');
    const type = amount > 0 ? 'earn' : 'spend';
    const applied = await applyTransaction(db, { playerId: targetId, transactionId: `${actionId}:currency`, currencyType: String(body.currencyType).toLowerCase() === 'gems' ? 'gems' : 'coins', type, amount: Math.abs(amount), source: 'admin_action', metadata: { reason: body.reason || '', actionId, adminId: identity.telegramId }, trusted: true });
    result = { ...result, transaction: applied.transaction, duplicate: applied.duplicate };
  } else if (operation === 'set_xp') {
    const totalXP = integer(body.totalXP ?? body.amount);
    if (totalXP > 100000000) throw new HttpError(400, 'invalid_xp', 'XP is outside the allowed range');
    await run(db, `UPDATE progress SET xp = ?, total_xp = ?, updated_at = ? WHERE player_id = ?`, [totalXP, totalXP, Date.now(), targetId]);
    result = { ...result, totalXP };
  } else if (operation === 'set_streak') {
    const currentStreak = boundedInteger(body.currentStreak, 100000), bestStreak = boundedInteger(body.bestStreak, 100000);
    const streak = { currentStreak, bestStreak: Math.max(currentStreak, bestStreak) };
    await run(db, `UPDATE progress SET streak_json = ?, updated_at = ? WHERE player_id = ?`, [JSON.stringify(streak), Date.now(), targetId]);
    result = { ...result, streak };
  } else if (operation === 'grant_achievement' || operation === 'revoke_achievement') {
    const row = await first(db, `SELECT achievements_json FROM progress WHERE player_id = ?`, [targetId]);
    const current = parseJson(row?.achievements_json, []), achievementId = String(body.achievementId || '').trim();
    if (!achievementId || achievementId.length > 128) throw new HttpError(400, 'achievement_required', 'Achievement id is required');
    const ids = current.map(item => typeof item === 'string' ? item : item?.id).filter(Boolean);
    const next = operation === 'grant_achievement' ? Array.from(new Set([...ids, achievementId])) : ids.filter(value => value !== achievementId);
    await run(db, `UPDATE progress SET achievements_json = ?, updated_at = ? WHERE player_id = ?`, [JSON.stringify(next), Date.now(), targetId]);
    result = { ...result, achievementId };
  } else if (operation === 'grant_item' || operation === 'revoke_item') {
    const row = await first(db, `SELECT profile_json, games_json FROM inventory WHERE player_id = ?`, [targetId]);
    const profile = parseJson(row?.profile_json, {}), games = parseJson(row?.games_json, {}), gameId = String(body.gameId || '').trim(), itemId = String(body.itemId || '').trim();
    if (!itemId || itemId.length > 128 || (gameId && !KNOWN_GAME_IDS.has(gameId)) || !SHOP_CATALOG[itemId] || (gameId && SHOP_CATALOG[itemId].gameId !== gameId) || (!gameId && SHOP_CATALOG[itemId].scope !== 'profile')) throw new HttpError(400, 'item_required', 'Item id is required');
    if (gameId) {
      const scope = games[gameId] || { ownedItems: [], equippedItems: {}, purchaseHistory: [] };
      const owned = Array.isArray(scope.ownedItems) ? scope.ownedItems : [];
      scope.ownedItems = operation === 'grant_item' ? Array.from(new Set([...owned, itemId])) : owned.filter(value => value !== itemId);
      if (operation === 'revoke_item') scope.equippedItems = Object.fromEntries(Object.entries(scope.equippedItems || {}).filter(([, value]) => value !== itemId));
      games[gameId] = scope;
    } else {
      const owned = Array.isArray(profile.ownedItems) ? profile.ownedItems : [];
      profile.ownedItems = operation === 'grant_item' ? Array.from(new Set([...owned, itemId])) : owned.filter(value => value !== itemId);
      if (operation === 'revoke_item') profile.equippedItems = Object.fromEntries(Object.entries(profile.equippedItems || {}).filter(([, value]) => value !== itemId));
    }
    await run(db, `UPDATE inventory SET profile_json = ?, games_json = ?, updated_at = ? WHERE player_id = ?`, [JSON.stringify(profile), JSON.stringify(games), Date.now(), targetId]);
    result = { ...result, itemId, gameId: gameId || null };
  } else if (operation === 'payment_compensation') {
    const paymentId = String(body.paymentId || '').trim(), amount = integer(body.amount);
    if (!paymentId || !amount) throw new HttpError(400, 'payment_compensation_invalid', 'Payment id and positive Gems amount are required');
    const payment = await paymentById(db, paymentId);
    if (!payment || String(payment.player_id) !== targetId) throw new HttpError(404, 'payment_not_found', 'Payment does not belong to the target player');
    const applied = await applyTransaction(db, { playerId: targetId, transactionId: `${actionId}:payment-compensation`, currencyType: 'gems', type: 'earn', amount, source: 'admin_action', metadata: { reason: body.reason || '', actionId, adminId: identity.telegramId, paymentId, compensation: true }, trusted: true });
    result = { ...result, transaction: applied.transaction, duplicate: applied.duplicate, paymentId };
  } else {
    throw new HttpError(400, 'unsupported_admin_operation', 'Admin operation is not supported');
  }
  const entry = { id: actionId, adminId: identity.telegramId, role: 'owner', action: String(body.action || operation), targetPlayerId: targetId, amount: body.amount ?? null, reason: body.reason || '', metadata: { ...clone(body.metadata || {}), operation, result }, timestamp: Date.now() };
  await logAdminAction(db, entry);
  return result;
}

const GAME_RESULT_KEYS = new Set(['event', 'score', 'gameId', 'goals', 'saves', 'maxCombo', 'progress', 'completed', 'victory', 'levelCompleted', 'playTime', 'distance', 'nearMisses', 'turboUses', 'shots', 'reason', 'bestScore']);
const sanitizeGameResult = result => {
  const source = result && typeof result === 'object' && !Array.isArray(result) ? result : {};
  const safe = {};
  for (const key of GAME_RESULT_KEYS) {
    const value = source[key];
    if (typeof value === 'string') safe[key] = value.slice(0, 128);
    else if (typeof value === 'boolean') safe[key] = value;
    else if (Number.isFinite(Number(value))) safe[key] = boundedInteger(value, MAX_GAME_SCORE);
  }
  return safe;
};

async function updateDerivedGameStats(db, playerId, gameId, score, duration) {
  const row = await playerRow(db, playerId);
  if (!row) return;
  const records = parseJson(row.records_json, {}), previous = records[gameId] && typeof records[gameId] === 'object' ? records[gameId] : {};
  const statistics = parseJson(row.statistics_json, {});
  const gamesPlayed = boundedInteger(statistics.gamesPlayed ?? statistics.totalGames, 10_000_000) + 1;
  const totalGames = boundedInteger(statistics.totalGames ?? statistics.gamesPlayed, 10_000_000) + 1;
  const launchesByGame = { ...(statistics.launchesByGame || {}) };
  launchesByGame[gameId] = boundedInteger(launchesByGame[gameId], 10_000_000) + 1;
  records[gameId] = {
    ...previous,
    bestScore: Math.max(boundedInteger(previous.bestScore, MAX_GAME_SCORE), score),
    lastScore: score,
    gamesPlayed: boundedInteger(previous.gamesPlayed, 10_000_000) + 1,
    lastPlayedAt: Date.now()
  };
  const nextStatistics = {
    ...statistics,
    gamesPlayed,
    totalGames,
    totalScore: Math.min(Number.MAX_SAFE_INTEGER, boundedInteger(statistics.totalScore, Number.MAX_SAFE_INTEGER) + score),
    totalPlayTime: Math.min(Number.MAX_SAFE_INTEGER, boundedInteger(statistics.totalPlayTime, Number.MAX_SAFE_INTEGER) + duration),
    launchesByGame
  };
  await run(db, `UPDATE players SET records_json = ?, statistics_json = ?, last_active = ? WHERE telegram_id = ?`, [JSON.stringify(records), JSON.stringify(nextStatistics), Date.now(), playerId]);
}

const serializeRewardProof = row => row ? ({
  id: String(row.id), playerId: String(row.player_id), gameId: String(row.game_id), sessionId: String(row.session_id),
  reward: parseJson(row.reward_data_json, {}), rewardData: parseJson(row.reward_data_json, {}), status: row.status,
  createdAt: Number(row.created_at || 0), updatedAt: Number(row.updated_at || row.created_at || 0)
}) : null;
const serializeGameResult = row => row ? ({
  id: String(row.id), playerId: String(row.player_id), gameId: String(row.game_id), sessionId: String(row.session_id),
  score: Number(row.score || 0), duration: Number(row.duration || 0), metadata: parseJson(row.metadata_json, {}),
  validated: Boolean(Number(row.validated || 0)), rejectionCode: row.rejection_code || null, rewardProofId: row.reward_proof_id || null,
  createdAt: Number(row.created_at || 0)
}) : null;
const serializeFraudEvent = row => row ? ({ id: String(row.id), playerId: String(row.player_id), gameId: row.game_id || null, sessionId: row.session_id || null, type: row.type, metadata: parseJson(row.metadata_json, {}), createdAt: Number(row.created_at || 0) }) : null;

const rewardProofIdFor = (playerId, sessionId) => `reward-proof:${playerId}:${sessionId}`;
const gameResultIdFor = (playerId, sessionId) => `game-result:${playerId}:${sessionId}`;
const rewardTransactionIdFor = (proofId, currency) => `${proofId}:${currency}`;

const rewardValidation = ({ gameId, score, duration, result, session }) => {
  const rules = REWARD_RULES[gameId];
  if (!rules) return { code: 'unknown_game', message: 'Reward rules are not configured for this game' };
  if (!Number.isInteger(score) || score < 0 || score > rules.maxScore) return { code: 'invalid_game_score', message: 'Game score is outside the reward limits' };
  if (!Number.isInteger(duration) || duration < 0 || duration > MAX_GAME_DURATION) return { code: 'invalid_game_duration', message: 'Game duration is outside the reward limits' };
  if (score > 0 && duration < rules.minDuration) return { code: 'impossible_duration', message: 'The result duration is too short for this score' };
  const seconds = Math.max(0.25, duration / 1000);
  if (score > Math.ceil(seconds * rules.maxScorePerSecond) + 500) return { code: 'impossible_score_rate', message: 'The reported score is not physically plausible' };
  if (session?.started_at && session?.finished_at && Number(session.finished_at) < Number(session.started_at)) return { code: 'invalid_session_time', message: 'The game session time is invalid' };
  return null;
};

async function recordFraudEvent(db, { playerId, gameId, sessionId, type, metadata = {} }) {
  const event = { id: id('fraud'), playerId, gameId: gameId || null, sessionId: sessionId || null, type, metadata: clone(metadata), createdAt: Date.now() };
  await run(db, `INSERT INTO fraud_events (id, player_id, game_id, session_id, type, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT (id) DO NOTHING`, [event.id, event.playerId, event.gameId, event.sessionId, event.type, JSON.stringify(event.metadata), event.createdAt]);
  return event;
}

async function applyServerProgressReward(db, playerId, xpAmount, achievementIds = []) {
  const row = await first(db, `SELECT level, xp, total_xp, rank, achievements_json FROM progress WHERE player_id = ?`, [playerId]);
  if (!row) throw new HttpError(404, 'player_not_found', 'Player progress does not exist');
  const currentTotal = integer(row.total_xp), nextTotal = Math.min(100000000, currentTotal + integer(xpAmount));
  const level = Math.min(100, Math.max(1, Math.floor(nextTotal / 1000) + 1));
  const achievements = parseJson(row.achievements_json, []);
  const currentIds = achievements.map(item => typeof item === 'string' ? item : item?.id).filter(Boolean);
  const nextAchievements = Array.from(new Set([...currentIds, ...achievementIds.map(String)])).slice(0, MAX_MIGRATION_ACHIEVEMENTS);
  await run(db, `UPDATE progress SET level = ?, xp = ?, total_xp = ?, rank = ?, achievements_json = ?, updated_at = ? WHERE player_id = ?`, [level, nextTotal % 1000, nextTotal, level >= 76 ? 'legend' : level >= 51 ? 'master' : level >= 26 ? 'pro' : level >= 11 ? 'player' : 'rookie', JSON.stringify(nextAchievements), Date.now(), playerId]);
  return { xp: integer(xpAmount), totalXP: nextTotal, level, achievements: nextAchievements, achievementIds: achievementIds.filter(item => !currentIds.includes(String(item))).map(String) };
}

async function submitGameResult(db, identity, body) {
  const gameId = String(body.gameId || '').trim(), sessionId = String(body.sessionId || '').trim();
  if (!gameId || !KNOWN_GAME_IDS.has(gameId)) throw new HttpError(400, 'unknown_game', 'gameId is not registered');
  if (!sessionId || sessionId.length > MAX_TRANSACTION_ID_LENGTH) throw new HttpError(400, 'invalid_session_id', 'Session id is invalid');
  if (body.playerId != null && String(body.playerId) !== identity.telegramId) throw new HttpError(403, 'player_forbidden', 'Result player must match Telegram identity');
  const session = await first(db, `SELECT id, player_id, game_id, started_at, finished_at, score, duration, result_json, created_at FROM game_sessions WHERE id = ?`, [sessionId]);
  if (!session) throw new HttpError(404, 'session_not_found', 'Game session does not exist');
  if (String(session.player_id) !== identity.telegramId) throw new HttpError(403, 'session_forbidden', 'Game session belongs to another player');
  if (String(session.game_id) !== gameId) throw new HttpError(409, 'session_game_conflict', 'Result game does not match the session');
  if (session.finished_at == null) throw new HttpError(409, 'session_not_finished', 'Game session is not finished');
  const score = Number(body.score ?? body.result?.score), duration = Number(body.duration ?? body.result?.duration ?? session.duration);
  if (!Number.isInteger(score) || !Number.isInteger(duration)) throw new HttpError(400, 'invalid_game_result', 'score and duration must be integers');
  if (score !== Number(session.score || 0) || duration !== Number(session.duration || 0)) throw new HttpError(409, 'result_session_mismatch', 'Result does not match the recorded game session');
  const timestamp = Number(body.timestamp || body.finishedAt || Date.now());
  if (!Number.isFinite(timestamp) || Math.abs(timestamp - Number(session.finished_at)) > MAX_RESULT_TIMESTAMP_SKEW) throw new HttpError(400, 'invalid_result_timestamp', 'Result timestamp is outside the session window');
  const safeResult = sanitizeGameResult(body.metadata || body.result || parseJson(session.result_json, {}));
  const resultId = gameResultIdFor(identity.telegramId, sessionId), proofId = rewardProofIdFor(identity.telegramId, sessionId);
  const existingProof = await first(db, `SELECT id, player_id, game_id, session_id, reward_data_json, status, created_at, updated_at FROM reward_proofs WHERE id = ?`, [proofId]);
  if (existingProof?.status === 'issued') return { proof: serializeRewardProof(existingProof), duplicate: true, player: await player(db, identity.telegramId) };
  const existingResult = await first(db, `SELECT id, player_id, game_id, session_id, score, duration, metadata_json, validated, rejection_code, reward_proof_id, created_at FROM game_results WHERE id = ?`, [resultId]);
  if (existingResult?.validated && existingProof?.status === 'issued') return { proof: serializeRewardProof(existingProof), duplicate: true, player: await player(db, identity.telegramId) };
  const rejection = rewardValidation({ gameId, score, duration, result: safeResult, session });
  if (rejection) {
    if (!existingResult) await run(db, `INSERT INTO game_results (id, player_id, game_id, session_id, score, duration, metadata_json, validated, rejection_code, reward_proof_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, FALSE, ?, NULL, ?) ON CONFLICT (id) DO NOTHING`, [resultId, identity.telegramId, gameId, sessionId, score, duration, JSON.stringify(safeResult), rejection.code, Date.now()]);
    await recordFraudEvent(db, { playerId: identity.telegramId, gameId, sessionId, type: rejection.code, metadata: { score, duration, result: safeResult, message: rejection.message } });
    throw new HttpError(422, 'result_rejected', rejection.message, { reason: rejection.code });
  }
  const rules = REWARD_RULES[gameId], calculated = rules.calculate({ score, duration, result: safeResult });
  const current = await playerRow(db, identity.telegramId), stats = parseJson(current?.statistics_json, {}), achievementIds = Number(stats.totalGames || stats.gamesPlayed || 0) <= 1 ? ['first_game'] : [];
  const reward = { coins: integer(calculated.coins), gems: integer(calculated.gems), xp: integer(calculated.xp), achievements: achievementIds, source: 'server_game_result' };
  if (!existingResult) await run(db, `INSERT INTO game_results (id, player_id, game_id, session_id, score, duration, metadata_json, validated, rejection_code, reward_proof_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, FALSE, NULL, ?, ?) ON CONFLICT (id) DO NOTHING`, [resultId, identity.telegramId, gameId, sessionId, score, duration, JSON.stringify(safeResult), proofId, Date.now()]);
  await run(db, `INSERT INTO reward_proofs (id, player_id, game_id, session_id, reward_data_json, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'pending', ?, ?) ON CONFLICT (id) DO NOTHING`, [proofId, identity.telegramId, gameId, sessionId, JSON.stringify(reward), Date.now(), Date.now()]);
  const proof = await first(db, `SELECT id, player_id, game_id, session_id, reward_data_json, status, created_at, updated_at FROM reward_proofs WHERE id = ?`, [proofId]);
  if (proof?.status === 'issued') return { proof: serializeRewardProof(proof), duplicate: true, player: await player(db, identity.telegramId) };
  const claimed = await run(db, `UPDATE reward_proofs SET status = 'processing', updated_at = ? WHERE id = ? AND status = 'pending'`, [Date.now(), proofId]);
  if (affectedRows(claimed) !== 1) throw new HttpError(409, 'reward_in_progress', 'Reward is already being processed');
  if (reward.coins) await applyTransaction(db, { playerId: identity.telegramId, transactionId: rewardTransactionIdFor(proofId, 'coins'), currencyType: 'coins', type: 'earn', amount: reward.coins, source: 'game', metadata: { rewardProofId: proofId, sessionId, gameId }, trusted: true });
  if (reward.gems) await applyTransaction(db, { playerId: identity.telegramId, transactionId: rewardTransactionIdFor(proofId, 'gems'), currencyType: 'gems', type: 'earn', amount: reward.gems, source: 'game', metadata: { rewardProofId: proofId, sessionId, gameId }, trusted: true });
  const progressReward = await applyServerProgressReward(db, identity.telegramId, reward.xp, achievementIds);
  reward.totalXP = progressReward.totalXP;
  reward.level = progressReward.level;
  reward.achievements = progressReward.achievementIds;
  await run(db, `UPDATE reward_proofs SET reward_data_json = ?, status = 'issued', updated_at = ? WHERE id = ?`, [JSON.stringify(reward), Date.now(), proofId]);
  await run(db, `UPDATE game_results SET validated = TRUE, rejection_code = NULL, reward_proof_id = ? WHERE id = ?`, [proofId, resultId]);
  // Statistics and records are committed only after the result has passed
  // validation, so a forged session cannot inflate the player profile.
  await updateDerivedGameStats(db, identity.telegramId, gameId, score, duration);
  const issued = await first(db, `SELECT id, player_id, game_id, session_id, reward_data_json, status, created_at, updated_at FROM reward_proofs WHERE id = ?`, [proofId]);
  return { proof: serializeRewardProof(issued), reward, duplicate: false, player: await player(db, identity.telegramId) };
}

async function verifyPaymentWebhook(request, env) {
  const secret = String(env?.TELEPLAY_PAYMENT_WEBHOOK_SECRET || env?.PAYMENT_WEBHOOK_SECRET || '').trim();
  if (!secret) throw new HttpError(503, 'payment_webhook_not_configured', 'Payment webhook secret is not configured');
  if (request.headers.get(PAYMENT_WEBHOOK_SECRET_HEADER) !== secret) throw new HttpError(401, 'payment_webhook_unauthorized', 'Payment webhook secret is invalid');
}

async function handlePaymentWebhook(db, env, request) {
  await verifyPaymentWebhook(request, env);
  const update = await readBody(request);
  if (update?.pre_checkout_query) {
    const query = update.pre_checkout_query, payment = await paymentByPayload(db, String(query.invoice_payload || ''));
    let accepted = Boolean(payment && payment.status === 'pending' && String(query.from?.id || '') === String(payment?.player_id) && String(query.currency || '') === String(payment?.currency) && Number(query.total_amount) === Number(payment?.amount));
    const payload = { pre_checkout_query_id: String(query.id || ''), ok: accepted };
    if (!accepted) payload.error_message = 'Payment details are no longer valid';
    await telegramPaymentApi(env, 'answerPreCheckoutQuery', payload);
    return { ok: true, accepted };
  }
  const successful = update?.message?.successful_payment;
  if (successful) return settleSuccessfulPayment(db, { ...successful, telegram_user_id: update.message?.from?.id });
  const refunded = update?.message?.refunded_payment;
  if (refunded) return settleRefundedPayment(db, { ...refunded, telegram_user_id: update.message?.from?.id });
  return { ok: true, ignored: true };
}

const routePath = request => {
  const pathname = new URL(request.url).pathname.replace(/\/+/g, '/').replace(/\/$/, '') || '/';
  // Supabase Edge Functions receive requests under /functions/v1/<name>.
  // Keep the shared handler compatible with both that URL and local /health
  // or /players requests used by the adapter tests.
  const functionPath = pathname.match(/^\/functions\/v1\/[^/]+(\/.*)?$/);
  if (functionPath) return functionPath[1] || '/';
  // Supabase's Edge runtime can also pass the function slug without the
  // /functions/v1 gateway prefix (for example /teleplay-api/health).
  const runtimePath = pathname.match(/^\/teleplay-api(\/.*)?$/);
  return runtimePath ? runtimePath[1] || '/' : pathname;
};

async function handle(request, env) {
  const url = new URL(request.url), path = routePath(request), method = request.method.toUpperCase();
  if (path === '/health' && method === 'GET') {
    const healthDb = dbOf(env);
    if (!healthDb) return json({ status: 'error', ok: false, service: 'teleplay-api', database: 'not_configured', time: Date.now() }, 503);
    try {
      await first(healthDb, 'SELECT 1 AS healthy');
      // These booleans deliberately expose no secret or identifier. They make
      // a deployment error diagnosable without opening an administrative API.
      return json({ status: 'ok', ok: true, service: 'teleplay-api', database: 'connected', auth: { telegramConfigured: Boolean(env?.TELEGRAM_BOT_TOKEN), ownerConfigured: ownerIds(env).size > 0 }, time: Date.now() });
    }
    catch (_) { return json({ status: 'error', ok: false, service: 'teleplay-api', database: 'unavailable', time: Date.now() }, 503); }
  }
  const db = requireDb(env);

  if (path === '/telegram/payments/webhook' && method === 'POST') {
    return json(await handlePaymentWebhook(db, env, request));
  }
  if (path === '/payments/packages' && method === 'GET') {
    await authenticate(request, env);
    return json({ packages: paymentPackagesForClient(env) });
  }
  if (path === '/payments/invoice' && method === 'POST') {
    const identity = await authenticate(request, env), body = await readBody(request);
    const key = String(request.headers.get('X-Idempotency-Key') || body.idempotencyKey || '').trim();
    if (key.length > MAX_TRANSACTION_ID_LENGTH) throw new HttpError(400, 'invalid_idempotency_key', 'Idempotency key is invalid');
    return json(await createPaymentInvoice(db, env, identity, body, key || null), 201);
  }
  if (path === '/payments/me' && method === 'GET') {
    const identity = await authenticate(request, env), rows = await all(db, `${paymentSelect} WHERE player_id = ? ORDER BY created_at DESC LIMIT 100`, [identity.telegramId]);
    return json({ payments: rows.map(serializePayment) });
  }
  if (path === '/payments' && method === 'GET') {
    await requireOwner(request, env);
    const requestedPlayer = url.searchParams.get('playerId') || '', status = url.searchParams.get('status') || '';
    const filters = [requestedPlayer ? 'player_id = ?' : '', status ? 'status = ?' : ''].filter(Boolean);
    const rows = await all(db, `${paymentSelect} ${filters.length ? `WHERE ${filters.join(' AND ')}` : ''} ORDER BY created_at DESC LIMIT ${MAX_PAYMENT_HISTORY}`, [...(requestedPlayer ? [requestedPlayer] : []), ...(status ? [status] : [])]);
    return json({ payments: rows.map(serializePayment) });
  }

  if (path === '/players/me' && method === 'POST') {
    const identity = await authenticate(request, env), existing = await player(db, identity.telegramId);
    if (existing) return json({ player: existing, created: false });
    const result = await createSnapshot(db, { telegramId: identity.telegramId, username: identity.user?.username || '', firstName: identity.user?.first_name || '', avatar: identity.user?.photo_url || '' }, identity);
    return json({ player: result.player, created: true }, 201);
  }
  if (path === '/players/me' && method === 'GET') {
    const identity = await authenticate(request, env), value = await player(db, identity.telegramId);
    if (!value) throw new HttpError(404, 'player_not_found', 'Player does not exist');
    await run(db, `UPDATE players SET last_active = ? WHERE telegram_id = ?`, [Date.now(), identity.telegramId]);
    return json({ player: value });
  }
  if (path === '/players/me/import' && method === 'POST') {
    const identity = await authenticate(request, env), body = await readBody(request), result = await importLocalSnapshot(db, identity, body?.snapshot || body);
    return json(result, result.imported ? 201 : 200);
  }
  if (path === '/players/me/state' && method === 'PUT') {
    const identity = await authenticate(request, env), body = await readBody(request), value = await syncPlayerState(db, identity, body);
    return json({ player: value, synced: true });
  }
  if (path === '/players' && method === 'GET') {
    await requireOwner(request, env);
    const rows = await all(db, playerSelect + ' ORDER BY p.last_active DESC LIMIT 1000');
    const params = url.searchParams, query = String(params.get('q') || '').trim().toLowerCase().replace(/^@/, ''), filter = params.get('filter') || '', sort = params.get('sort') || '';
    const today = new Date().toISOString().slice(0, 10);
    const values = rows.map(serializePlayer).filter(value => {
      const created = value.createdAt ? new Date(value.createdAt).toISOString().slice(0, 10) : '', active = value.lastActive ? new Date(value.lastActive).toISOString().slice(0, 10) : '';
      if (query && !value.telegramId.toLowerCase().includes(query) && !value.username.toLowerCase().includes(query)) return false;
      if (filter === 'new' && created !== today) return false;
      if (filter === 'active' && active !== today) return false;
      return true;
    }).sort((left, right) => sort === 'level' ? right.progress.level - left.progress.level : sort === 'played' ? Number(right.statistics.totalGames || 0) - Number(left.statistics.totalGames || 0) : String(left.username).localeCompare(String(right.username)));
    return json({ players: values });
  }
  const playerMatch = path.match(/^\/players\/([^/]+)$/);
  if (playerMatch && (method === 'GET' || method === 'PUT')) {
    const requestedId = decodeURIComponent(playerMatch[1]), identity = await authenticate(request, env);
    if (method === 'GET') {
      if (identity.telegramId !== requestedId && !ownerIds(env).has(identity.telegramId)) throw new HttpError(403, 'player_forbidden', 'Player access denied');
      return json({ player: await requirePlayer(db, requestedId) });
    }
    if (identity.telegramId !== requestedId) throw new HttpError(403, 'player_forbidden', 'Player import must match Telegram identity');
    const existing = await player(db, requestedId);
    if (existing) return json({ player: existing, imported: false });
    const result = await createSnapshot(db, await readBody(request), identity);
    return json(result, 201);
  }
  if (path === '/transactions' && method === 'GET') {
    const identity = await authenticate(request, env), requestedPlayer = url.searchParams.get('playerId') || identity.telegramId;
    if (requestedPlayer !== identity.telegramId && !ownerIds(env).has(identity.telegramId)) throw new HttpError(403, 'transactions_forbidden', 'Transaction access denied');
    const rows = await all(db, `SELECT id, player_id, currency_type, type, amount, balance_after, source, metadata_json, created_at FROM transactions WHERE player_id = ? ORDER BY created_at DESC LIMIT 500`, [requestedPlayer]);
    return json({ transactions: rows.map(serializeTransaction) });
  }
  if (path === '/transactions' && method === 'POST') {
    const identity = await authenticate(request, env), body = await readBody(request), result = await applyTransaction(db, { playerId: identity.telegramId, transactionId: String(body.id || request.headers.get('X-Idempotency-Key') || id('tx')), currencyType: String(body.currencyType || body.currency).toLowerCase() === 'gems' ? 'gems' : 'coins', type: body.type, amount: body.amount, source: String(body.source || 'system'), metadata: body.metadata || {}, trusted: false });
    if (result.transaction.currencyType === 'gems' && result.transaction.type === 'spend' && result.transaction.metadata?.itemId) await paymentAnalytics(db, identity.telegramId, 'premium_purchase', { productId: result.transaction.metadata.itemId, amount: Math.abs(result.transaction.amount), currency: 'gems', transactionId: result.transaction.id }, result.transaction.id);
    return json({ ...result, balance: result.transaction.balanceAfter }, result.duplicate ? 200 : 201);
  }
  if (path === '/games/result' && method === 'POST') {
    const identity = await authenticate(request, env), body = await readBody(request), now = Date.now();
    const minute = await first(db, `SELECT COUNT(*) AS count FROM game_results WHERE player_id = ? AND created_at >= ?`, [identity.telegramId, now - 60_000]);
    const hour = await first(db, `SELECT COUNT(*) AS count FROM game_results WHERE player_id = ? AND created_at >= ?`, [identity.telegramId, now - 60 * 60_000]);
    if (Number(minute?.count || 0) >= MAX_REWARD_RESULTS_PER_MINUTE || Number(hour?.count || 0) >= MAX_REWARD_RESULTS_PER_HOUR) throw new HttpError(429, 'reward_rate_limited', 'Too many game result submissions');
    const result = await submitGameResult(db, identity, body);
    return json({ rewardProof: result.proof, reward: result.reward || result.proof?.rewardData || {}, player: result.player, duplicate: Boolean(result.duplicate) }, result.duplicate ? 200 : 201);
  }
  if (path === '/game-sessions' && method === 'POST') {
    const identity = await authenticate(request, env), body = await readBody(request), sessionId = String(body.id || request.headers.get('X-Idempotency-Key') || id('session')), gameId = String(body.gameId || '').trim();
    if (!gameId) throw new HttpError(400, 'game_id_required', 'gameId is required');
    if (!KNOWN_GAME_IDS.has(gameId)) throw new HttpError(400, 'unknown_game', 'gameId is not registered');
    if (!sessionId || sessionId.length > MAX_TRANSACTION_ID_LENGTH) throw new HttpError(400, 'invalid_session_id', 'Session id is invalid');
    const now = Date.now(), startedAt = integer(body.startedAt || now), hasFinished = body.finishedAt != null || body.result?.event !== 'started';
    if (startedAt > now + MAX_FUTURE_SKEW || now - startedAt > MAX_SESSION_AGE) throw new HttpError(400, 'invalid_session_time', 'Session start time is invalid');
    const scoreNumber = Number(body.score ?? 0), durationNumber = Number(body.duration ?? 0);
    if (!Number.isFinite(scoreNumber) || !Number.isInteger(scoreNumber) || scoreNumber < 0 || scoreNumber > MAX_GAME_SCORE) throw new HttpError(400, 'invalid_game_score', 'Game score is outside the allowed range');
    if (!Number.isFinite(durationNumber) || !Number.isInteger(durationNumber) || durationNumber < 0 || durationNumber > MAX_GAME_DURATION) throw new HttpError(400, 'invalid_game_duration', 'Game duration is outside the allowed range');
    const reportedReward = Number(body.reward ?? body.result?.reward ?? 0);
    if (Number.isFinite(reportedReward) && reportedReward > 1000) throw new HttpError(400, 'invalid_game_reward', 'Client-reported reward is outside the allowed range');
    let finishedAt = null;
    if (hasFinished) {
      finishedAt = integer(body.finishedAt || now);
      if (finishedAt < startedAt || finishedAt > now + MAX_FUTURE_SKEW || now - finishedAt > MAX_SESSION_AGE) throw new HttpError(400, 'invalid_session_time', 'Session finish time is invalid');
    }
    const safeResult = sanitizeGameResult(body.result || {});
    const existing = await first(db, `SELECT id, player_id, game_id, started_at, finished_at, score, duration, result_json, created_at FROM game_sessions WHERE id = ?`, [sessionId]);
    if (!existing && hasFinished && safeResult.event !== 'started') throw new HttpError(409, 'session_start_required', 'A game session must be started before it can be finished');
    if (existing) {
      if (String(existing.player_id) !== identity.telegramId || existing.game_id !== gameId) throw new HttpError(409, 'session_id_conflict', 'Session id belongs to another game or player');
      const wasFinished = existing.finished_at != null;
      if (hasFinished && !wasFinished) {
        await run(db, `UPDATE game_sessions SET finished_at = ?, score = ?, duration = ?, result_json = ? WHERE id = ? AND player_id = ? AND finished_at IS NULL`, [finishedAt, scoreNumber, durationNumber, JSON.stringify(safeResult), sessionId, identity.telegramId]);
      }
      return json({ session: { id: sessionId, playerId: identity.telegramId, gameId: existing.game_id, startedAt: existing.started_at, finishedAt: hasFinished && !wasFinished ? finishedAt : existing.finished_at, score: hasFinished && !wasFinished ? scoreNumber : Number(existing.score || 0), duration: hasFinished && !wasFinished ? durationNumber : Number(existing.duration || 0), result: hasFinished && !wasFinished ? safeResult : parseJson(existing.result_json, {}), createdAt: existing.created_at }, duplicate: true });
    }
    const recentSessions = await first(db, `SELECT COUNT(*) AS count FROM game_sessions WHERE player_id = ? AND created_at >= ?`, [identity.telegramId, now - 60_000]);
    if (Number(recentSessions?.count || 0) >= MAX_SESSIONS_PER_MINUTE) throw new HttpError(429, 'rate_limited', 'Too many game sessions');
    const createdAt = now;
    await run(db, `INSERT INTO game_sessions (id, player_id, game_id, started_at, finished_at, score, duration, result_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [sessionId, identity.telegramId, gameId, startedAt, finishedAt, scoreNumber, durationNumber, JSON.stringify(safeResult), createdAt]);
    await run(db, `UPDATE players SET last_active = ? WHERE telegram_id = ?`, [createdAt, identity.telegramId]);
    return json({ session: { id: sessionId, playerId: identity.telegramId, gameId, startedAt, finishedAt, score: scoreNumber, duration: durationNumber, result: safeResult, createdAt } }, 201);
  }
  if (path === '/game-sessions' && method === 'GET') {
    const identity = await requireOwner(request, env), requestedPlayer = url.searchParams.get('playerId') || '';
    const rows = requestedPlayer ? await all(db, `SELECT id, player_id, game_id, started_at, finished_at, score, duration, result_json, created_at FROM game_sessions WHERE player_id = ? ORDER BY created_at DESC LIMIT 1000`, [requestedPlayer]) : await all(db, `SELECT id, player_id, game_id, started_at, finished_at, score, duration, result_json, created_at FROM game_sessions ORDER BY created_at DESC LIMIT 1000`);
    return json({ sessions: rows.map(row => ({ id: row.id, playerId: row.player_id, gameId: row.game_id, startedAt: row.started_at, finishedAt: row.finished_at, score: Number(row.score || 0), duration: Number(row.duration || 0), result: parseJson(row.result_json, {}), createdAt: row.created_at })) });
  }
  if (path === '/reward-proofs' && method === 'GET') {
    await requireOwner(request, env);
    const requestedPlayer = url.searchParams.get('playerId') || '', status = url.searchParams.get('status') || '';
    const rows = await all(db, `SELECT id, player_id, game_id, session_id, reward_data_json, status, created_at, updated_at FROM reward_proofs ${requestedPlayer || status ? 'WHERE ' + [requestedPlayer ? 'player_id = ?' : '', status ? 'status = ?' : ''].filter(Boolean).join(' AND ') : ''} ORDER BY created_at DESC LIMIT 500`, [ ...(requestedPlayer ? [requestedPlayer] : []), ...(status ? [status] : []) ]);
    return json({ proofs: rows.map(serializeRewardProof) });
  }
  if (path === '/game-results' && method === 'GET') {
    await requireOwner(request, env);
    const requestedPlayer = url.searchParams.get('playerId') || '', validated = url.searchParams.get('validated');
    const filters = [requestedPlayer ? 'player_id = ?' : '', validated === 'true' || validated === 'false' ? 'validated = ?' : ''].filter(Boolean);
    const args = [ ...(requestedPlayer ? [requestedPlayer] : []), ...(validated === 'true' || validated === 'false' ? [validated === 'true'] : []) ];
    const rows = await all(db, `SELECT id, player_id, game_id, session_id, score, duration, metadata_json, validated, rejection_code, reward_proof_id, created_at FROM game_results ${filters.length ? `WHERE ${filters.join(' AND ')}` : ''} ORDER BY created_at DESC LIMIT 500`, args);
    return json({ results: rows.map(serializeGameResult) });
  }
  if (path === '/fraud-events' && method === 'GET') {
    await requireOwner(request, env);
    const requestedPlayer = url.searchParams.get('playerId') || '';
    const rows = await all(db, `SELECT id, player_id, game_id, session_id, type, metadata_json, created_at FROM fraud_events ${requestedPlayer ? 'WHERE player_id = ?' : ''} ORDER BY created_at DESC LIMIT 500`, requestedPlayer ? [requestedPlayer] : []);
    return json({ events: rows.map(serializeFraudEvent) });
  }
  if (path === '/analytics/events' && method === 'POST') {
    const identity = await authenticate(request, env), body = await readBody(request), eventId = String(body.id || request.headers.get('X-Idempotency-Key') || id('event'));
    if (!eventId || eventId.length > MAX_TRANSACTION_ID_LENGTH) throw new HttpError(400, 'invalid_event_id', 'Event id is invalid');
    const eventName = String(body.event || 'unknown').trim();
    if (!eventName || eventName.length > MAX_EVENT_LENGTH) throw new HttpError(400, 'invalid_event_name', 'Event name is invalid');
    const metadata = body.metadata || body.params || {};
    if (encodedSize(metadata) > MAX_METADATA_BYTES) throw new HttpError(413, 'metadata_too_large', 'Event metadata is too large');
    const existing = await first(db, `SELECT id, player_id, event, metadata_json, created_at FROM analytics_events WHERE id = ?`, [eventId]);
    if (existing) {
      if (String(existing.player_id) !== identity.telegramId) throw new HttpError(409, 'event_id_conflict', 'Event id belongs to another player');
      return json({ event: { id: existing.id, playerId: existing.player_id, event: existing.event, metadata: parseJson(existing.metadata_json, {}), createdAt: existing.created_at }, duplicate: true });
    }
    const recentEvents = await first(db, `SELECT COUNT(*) AS count FROM analytics_events WHERE player_id = ? AND created_at >= ?`, [identity.telegramId, Date.now() - 60_000]);
    if (Number(recentEvents?.count || 0) >= MAX_EVENTS_PER_MINUTE) throw new HttpError(429, 'rate_limited', 'Too many analytics events');
    const event = { id: eventId, playerId: identity.telegramId, event: eventName, metadata: clone(metadata), createdAt: Date.now() };
    await run(db, `INSERT INTO analytics_events (id, player_id, event, metadata_json, created_at) VALUES (?, ?, ?, ?, ?)`, [event.id, event.playerId, event.event, JSON.stringify(event.metadata), event.createdAt]);
    await run(db, `UPDATE players SET last_active = ? WHERE telegram_id = ?`, [event.createdAt, identity.telegramId]);
    return json({ event }, 201);
  }
  if (path === '/analytics/events' && method === 'GET') {
    const identity = await authenticate(request, env), requestedPlayer = url.searchParams.get('playerId') || '';
    if (!ownerIds(env).has(identity.telegramId)) throw new HttpError(403, 'events_forbidden', 'Owner permission is required');
    const rows = requestedPlayer ? await all(db, `SELECT id, player_id, event, metadata_json, created_at FROM analytics_events WHERE player_id = ? ORDER BY created_at DESC LIMIT 1000`, [requestedPlayer]) : await all(db, `SELECT id, player_id, event, metadata_json, created_at FROM analytics_events ORDER BY created_at DESC LIMIT 1000`);
    return json({ events: rows.map(row => ({ id: row.id, playerId: row.player_id, event: row.event, metadata: parseJson(row.metadata_json, {}), createdAt: Number(row.created_at) })) });
  }
  if (path === '/admin/actions' && method === 'POST') {
    const identity = await requireOwner(request, env), result = await applyAdminAction(db, identity, await readBody(request));
    return json(result, result.duplicate ? 200 : 201);
  }
  if (path === '/admin/actions' && method === 'GET') {
    const identity = await requireOwner(request, env), requestedPlayer = url.searchParams.get('playerId') || '';
    const rows = requestedPlayer ? await all(db, `SELECT id, admin_id, role, target_player_id, action, metadata_json, created_at FROM admin_actions WHERE target_player_id = ? ORDER BY created_at DESC LIMIT 500`, [requestedPlayer]) : await all(db, `SELECT id, admin_id, role, target_player_id, action, metadata_json, created_at FROM admin_actions ORDER BY created_at DESC LIMIT 500`);
    return json({ actions: rows.map(row => ({ id: row.id, adminId: row.admin_id, role: row.role, targetPlayer: row.target_player_id, action: row.action, metadata: parseJson(row.metadata_json, {}), timestamp: Number(row.created_at) })) });
  }
  throw new HttpError(404, 'route_not_found', `No route for ${method} ${path}`);
}

const handler = async (request, env = {}) => {
  const cors = originHeaders(request, env), requestId = request.headers.get('X-Request-Id') || id('request');
  if (request.method.toUpperCase() === 'OPTIONS') return empty(204, { ...cors, 'Access-Control-Max-Age': '600' });
  try {
    const response = await handle(request, env);
    Object.entries({ ...cors, 'X-Request-Id': requestId }).forEach(([key, value]) => response.headers.set(key, value));
    return response;
  } catch (error) {
    const status = Number(error?.status) || 500;
    console.error(JSON.stringify({ requestId, status, code: error?.code || 'internal_error', message: error?.message || String(error) }));
    return json({ error: error?.code || 'internal_error', message: status >= 500 ? 'Internal server error' : error?.message, requestId, ...(status < 500 ? { details: error?.details || {} } : {}) }, status, { ...cors, 'X-Request-Id': requestId });
  }
};

export default { fetch: handler };
export { handler };
