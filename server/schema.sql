-- TelePlay server schema (SQLite / Cloudflare D1 compatible)
-- The immutable Telegram user id is the external player key.  The integer
-- primary key is an internal database id and is never exposed as identity.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS players (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  telegram_id TEXT NOT NULL UNIQUE,
  username TEXT NOT NULL DEFAULT '',
  first_name TEXT NOT NULL DEFAULT '',
  avatar TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  last_active INTEGER NOT NULL,
  records_json TEXT NOT NULL DEFAULT '{}',
  statistics_json TEXT NOT NULL DEFAULT '{}',
  state_json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS progress (
  player_id TEXT PRIMARY KEY REFERENCES players(telegram_id) ON DELETE CASCADE,
  level INTEGER NOT NULL DEFAULT 1,
  xp INTEGER NOT NULL DEFAULT 0,
  total_xp INTEGER NOT NULL DEFAULT 0,
  rank TEXT NOT NULL DEFAULT 'rookie',
  streak_json TEXT NOT NULL DEFAULT '{}',
  achievements_json TEXT NOT NULL DEFAULT '[]',
  mastery_json TEXT NOT NULL DEFAULT '{}',
  titles_json TEXT NOT NULL DEFAULT '{}',
  challenges_json TEXT NOT NULL DEFAULT '{}',
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS economy (
  player_id TEXT PRIMARY KEY REFERENCES players(telegram_id) ON DELETE CASCADE,
  coins INTEGER NOT NULL DEFAULT 0 CHECK (coins >= 0),
  gems INTEGER NOT NULL DEFAULT 0 CHECK (gems >= 0),
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS inventory (
  player_id TEXT PRIMARY KEY REFERENCES players(telegram_id) ON DELETE CASCADE,
  profile_json TEXT NOT NULL DEFAULT '{}',
  games_json TEXT NOT NULL DEFAULT '{}',
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS player_migrations (
  id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL REFERENCES players(telegram_id) ON DELETE CASCADE,
  migration_version TEXT NOT NULL,
  source TEXT NOT NULL,
  completed_at INTEGER NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  UNIQUE(player_id, migration_version)
);

CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL REFERENCES players(telegram_id) ON DELETE CASCADE,
  currency_type TEXT NOT NULL CHECK (currency_type IN ('coins', 'gems')),
  type TEXT NOT NULL CHECK (type IN ('earn', 'spend')),
  amount INTEGER NOT NULL,
  balance_after INTEGER NOT NULL CHECK (balance_after >= 0),
  source TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL REFERENCES players(telegram_id) ON DELETE CASCADE,
  package_id TEXT NOT NULL,
  invoice_id TEXT NOT NULL UNIQUE,
  invoice_payload TEXT NOT NULL UNIQUE,
  invoice_link TEXT,
  payment_provider TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  gems_amount INTEGER NOT NULL CHECK (gems_amount > 0),
  telegram_payment_charge_id TEXT UNIQUE,
  provider_payment_charge_id TEXT,
  idempotency_key TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  completed_at INTEGER,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS game_sessions (
  id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL REFERENCES players(telegram_id) ON DELETE CASCADE,
  game_id TEXT NOT NULL,
  started_at INTEGER,
  finished_at INTEGER,
  score INTEGER NOT NULL DEFAULT 0,
  duration INTEGER NOT NULL DEFAULT 0,
  result_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL
);

-- A submitted result is immutable per game session.  The reward proof is the
-- only server-side authority that can mint the resulting economy/XP reward.
CREATE TABLE IF NOT EXISTS game_results (
  id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL REFERENCES players(telegram_id) ON DELETE CASCADE,
  game_id TEXT NOT NULL,
  session_id TEXT NOT NULL UNIQUE REFERENCES game_sessions(id) ON DELETE CASCADE,
  score INTEGER NOT NULL DEFAULT 0,
  duration INTEGER NOT NULL DEFAULT 0,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  validated INTEGER NOT NULL DEFAULT 0 CHECK (validated IN (0, 1)),
  rejection_code TEXT,
  reward_proof_id TEXT UNIQUE,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS reward_proofs (
  id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL REFERENCES players(telegram_id) ON DELETE CASCADE,
  game_id TEXT NOT NULL,
  session_id TEXT NOT NULL UNIQUE REFERENCES game_sessions(id) ON DELETE CASCADE,
  reward_data_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'issued', 'rejected', 'failed')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS fraud_events (
  id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL REFERENCES players(telegram_id) ON DELETE CASCADE,
  game_id TEXT,
  session_id TEXT,
  type TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS analytics_events (
  id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL REFERENCES players(telegram_id) ON DELETE CASCADE,
  event TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS admin_actions (
  id TEXT PRIMARY KEY,
  admin_id TEXT NOT NULL,
  role TEXT NOT NULL,
  target_player_id TEXT,
  action TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_players_last_active ON players(last_active DESC);
CREATE INDEX IF NOT EXISTS idx_players_level ON progress(level DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_player ON transactions(player_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_player_idempotency ON payments(player_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payments_player_created ON payments(player_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_status_created ON payments(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_package ON payments(package_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_player_migrations_player ON player_migrations(player_id, completed_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_player ON analytics_events(player_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_actions_target ON admin_actions(target_player_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_game_results_player ON game_results(player_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_game_results_validation ON game_results(validated, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reward_proofs_player ON reward_proofs(player_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reward_proofs_status ON reward_proofs(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fraud_events_player ON fraud_events(player_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fraud_events_created ON fraud_events(created_at DESC);
