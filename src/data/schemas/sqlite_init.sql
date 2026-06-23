-- Kala User Intelligence — SQLite local-first schema
-- Run: sqlite3 ~/.kala/kala.db < src/data/schemas/sqlite_init.sql
-- Postgres migration: same tables, swap INTEGER for SERIAL, TEXT for JSONB where noted

PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

-- ─── User profile (1 row per user, JSON document + indexed columns) ─────────

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
  profile_json    TEXT NOT NULL,          -- full UserProfile document
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_profile_core ON user_profile(core_number);

-- ─── Action logs (append-only, immutable after insert) ─────────────────────

CREATE TABLE IF NOT EXISTS action_log (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES user_profile(id) ON DELETE CASCADE,
  schema_version  TEXT NOT NULL DEFAULT '1.0.0',
  logged_at       TEXT NOT NULL,
  action_at       TEXT NOT NULL,
  action_summary  TEXT NOT NULL,
  action_domain   TEXT,
  tags_json       TEXT NOT NULL,          -- JSON array of strings
  conviction_level TEXT NOT NULL CHECK (conviction_level IN ('High','Medium','Low')),
  advisor_score   INTEGER NOT NULL,
  outcome_score   INTEGER NOT NULL CHECK (outcome_score BETWEEN 0 AND 10),
  outcome_success INTEGER NOT NULL DEFAULT 0,  -- 1 if outcome_score >= 7
  outcome_notes   TEXT,
  ph_number       INTEGER NOT NULL,
  ph_quality      TEXT NOT NULL,
  ph_is_master    INTEGER NOT NULL DEFAULT 0,
  muhurta_score   INTEGER,
  personal_day    INTEGER,
  zodiac_synergy  TEXT,
  combo_key       TEXT NOT NULL,
  snapshot_json   TEXT NOT NULL,          -- full timing_snapshot
  log_json        TEXT NOT NULL,          -- full ActionLogEntry document
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_log_user ON action_log(user_id);
CREATE INDEX IF NOT EXISTS idx_log_action_at ON action_log(action_at);
CREATE INDEX IF NOT EXISTS idx_log_ph ON action_log(user_id, ph_number);
CREATE INDEX IF NOT EXISTS idx_log_domain ON action_log(user_id, action_domain);
CREATE INDEX IF NOT EXISTS idx_log_combo ON action_log(user_id, combo_key);
CREATE INDEX IF NOT EXISTS idx_log_tags ON action_log(user_id);  -- tag search via JSON in app layer

-- ─── Pattern aggregates (materialized by PatternRecognizer) ─────────────────

CREATE TABLE IF NOT EXISTS pattern_aggregate (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES user_profile(id) ON DELETE CASCADE,
  aggregate_type  TEXT NOT NULL,          -- ph_hour | combo | domain_ph | conviction_band
  aggregate_key   TEXT NOT NULL,          -- e.g. "ph:8" or "combo:ph8|muhurta70|deal"
  sample_count    INTEGER NOT NULL DEFAULT 0,
  avg_outcome     REAL,
  success_rate    REAL,                   -- fraction with outcome >= 7
  std_dev         REAL,
  last_updated    TEXT NOT NULL DEFAULT (datetime('now')),
  meta_json       TEXT,                   -- extra stats
  UNIQUE(user_id, aggregate_type, aggregate_key)
);

CREATE INDEX IF NOT EXISTS idx_agg_user_type ON pattern_aggregate(user_id, aggregate_type);

-- ─── Learned rules (Phase 1 explicit rules promoted from aggregates) ────────

CREATE TABLE IF NOT EXISTS learned_rule (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES user_profile(id) ON DELETE CASCADE,
  rule_type       TEXT NOT NULL,          -- boost_ph | avoid_ph | boost_combo | domain_hint
  condition_json  TEXT NOT NULL,
  effect_json     TEXT NOT NULL,          -- { score_delta, conviction_hint, message }
  confidence      REAL NOT NULL,          -- 0-1 based on sample size + consistency
  sample_count    INTEGER NOT NULL,
  active          INTEGER NOT NULL DEFAULT 1,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_rule_user_active ON learned_rule(user_id, active);

-- ─── Audit / privacy ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS intelligence_audit (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL,
  event_type      TEXT NOT NULL,          -- log_ingested | pattern_recomputed | export | purge
  detail_json     TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);