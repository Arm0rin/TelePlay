-- Apply only to databases created before TelePlay production sync was added.
ALTER TABLE players ADD COLUMN state_json TEXT NOT NULL DEFAULT '{}';
