/** SQLite DDL — mirrors src/data/schemas/sqlite_init.sql */
export const SQLITE_SCHEMA = `
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS user_profile (
  id              TEXT PRIMARY KEY,
  schema_version  TEXT NOT NULL DEFAULT '1.0.0',
  display_name    TEXT NOT NULL,
  core_number     INTEGER NOT NULL,
  birth_date      TEXT NOT NULL,
  birth_time      TEXT NOT NULL,
  btn             INTEGER NOT NULL,
  transition_min  INTEGER NOT NULL DEFAULT 20,
  latitude        REAL NOT NULL,
  longitude       REAL NOT NULL,
  tz_offset_min   INTEGER NOT NULL DEFAULT 330,
  profile_json    TEXT NOT NULL,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS action_log (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES user_profile(id) ON DELETE CASCADE,
  schema_version  TEXT NOT NULL DEFAULT '1.0.0',
  logged_at       TEXT NOT NULL,
  action_at       TEXT NOT NULL,
  action_summary  TEXT NOT NULL,
  action_domain   TEXT,
  tags_json       TEXT NOT NULL,
  conviction_level TEXT NOT NULL CHECK (conviction_level IN ('High','Medium','Low')),
  advisor_score   INTEGER NOT NULL,
  outcome_score   INTEGER NOT NULL CHECK (outcome_score BETWEEN 0 AND 10),
  outcome_success INTEGER NOT NULL DEFAULT 0,
  outcome_notes   TEXT,
  ph_number       INTEGER NOT NULL,
  ph_quality      TEXT NOT NULL,
  ph_is_master    INTEGER NOT NULL DEFAULT 0,
  muhurta_score   INTEGER,
  personal_day    INTEGER,
  zodiac_synergy  TEXT,
  combo_key       TEXT NOT NULL,
  snapshot_json   TEXT NOT NULL,
  log_json        TEXT NOT NULL,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS pattern_aggregate (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES user_profile(id) ON DELETE CASCADE,
  aggregate_type  TEXT NOT NULL,
  aggregate_key   TEXT NOT NULL,
  sample_count    INTEGER NOT NULL DEFAULT 0,
  avg_outcome     REAL,
  success_rate    REAL,
  std_dev         REAL,
  last_updated    TEXT NOT NULL DEFAULT (datetime('now')),
  meta_json       TEXT,
  UNIQUE(user_id, aggregate_type, aggregate_key)
);

CREATE TABLE IF NOT EXISTS learned_rule (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES user_profile(id) ON DELETE CASCADE,
  rule_type       TEXT NOT NULL,
  condition_json  TEXT NOT NULL,
  effect_json     TEXT NOT NULL,
  confidence      REAL NOT NULL,
  sample_count    INTEGER NOT NULL,
  active          INTEGER NOT NULL DEFAULT 1,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
`;