/**
 * SQLite-backed IntelligenceStore (sql.js + IndexedDB persistence).
 */

import type { Database } from 'sql.js';
import type { ActionLogEntry, LearnedRule, PatternAggregate, UserProfile } from './types';
import { recomputeIntelligence } from './patternRecognizer';
import type { IntelligenceStore } from './memoryStore';
import { createKartikayProfile } from './profileFactory';
import { exportDatabase, openDatabase } from './sqlite/db';
import { loadDbBytes, saveDbBytes } from './sqlite/idb';

const LEGACY_STORAGE_KEY = 'kaal_intelligence_v1';

interface LegacyPersistedState {
  profile: UserProfile;
  logs: ActionLogEntry[];
}

export class SqliteIntelligenceStore implements IntelligenceStore {
  private readonly db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  static async create(): Promise<SqliteIntelligenceStore> {
    const bytes = await loadDbBytes();
    const db = await openDatabase(bytes ?? undefined);
    return new SqliteIntelligenceStore(db);
  }

  async hydrate(): Promise<string> {
    const existing = this.db.exec('SELECT id FROM user_profile LIMIT 1');
    if (existing.length > 0 && existing[0].values.length > 0) {
      return String(existing[0].values[0][0]);
    }

    const migrated = this.migrateFromLocalStorage();
    if (migrated) {
      await this.flush();
      return migrated;
    }

    const profile = createKartikayProfile();
    this.saveProfile(profile);
    await this.flush();
    return profile.id;
  }

  getProfile(userId: string): UserProfile | undefined {
    const stmt = this.db.prepare('SELECT profile_json FROM user_profile WHERE id = ?');
    stmt.bind([userId]);
    if (!stmt.step()) {
      stmt.free();
      return undefined;
    }
    const row = stmt.getAsObject() as { profile_json: string };
    stmt.free();
    return JSON.parse(row.profile_json) as UserProfile;
  }

  saveProfile(profile: UserProfile): void {
    this.db.run(
      `INSERT INTO user_profile (
        id, schema_version, display_name, core_number, birth_date, birth_time, btn,
        transition_min, latitude, longitude, tz_offset_min, profile_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        profile_json = excluded.profile_json,
        display_name = excluded.display_name,
        core_number = excluded.core_number,
        updated_at = excluded.updated_at`,
      [
        profile.id,
        profile.schema_version,
        profile.identity.display_name,
        profile.numerology.core_number,
        profile.birth.date,
        profile.birth.time,
        profile.numerology.btn,
        profile.personal_hours.transition_minute,
        profile.location.latitude,
        profile.location.longitude,
        profile.location.timezone_offset_minutes,
        JSON.stringify(profile),
        profile.created_at,
        profile.updated_at,
      ]
    );
  }

  getLogs(userId: string): ActionLogEntry[] {
    const stmt = this.db.prepare(
      'SELECT log_json FROM action_log WHERE user_id = ? ORDER BY action_at ASC'
    );
    stmt.bind([userId]);
    const logs: ActionLogEntry[] = [];
    while (stmt.step()) {
      const row = stmt.getAsObject() as { log_json: string };
      logs.push(JSON.parse(row.log_json) as ActionLogEntry);
    }
    stmt.free();
    return logs;
  }

  appendLog(entry: ActionLogEntry): void {
    const normalized: ActionLogEntry = {
      ...entry,
      outcome: { ...entry.outcome, success: entry.outcome.score >= 7 },
    };

    const snap = normalized.timing_snapshot;
    this.db.run(
      `INSERT INTO action_log (
        id, user_id, schema_version, logged_at, action_at, action_summary, action_domain,
        tags_json, conviction_level, advisor_score, outcome_score, outcome_success, outcome_notes,
        ph_number, ph_quality, ph_is_master, muhurta_score, personal_day, zodiac_synergy,
        combo_key, snapshot_json, log_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        normalized.id,
        normalized.user_id,
        normalized.schema_version,
        normalized.logged_at,
        normalized.action_at,
        normalized.action.summary,
        normalized.action.domain ?? null,
        JSON.stringify(normalized.tags),
        normalized.conviction.level,
        Math.round(normalized.conviction.advisor_score),
        normalized.outcome.score,
        normalized.outcome.success ? 1 : 0,
        normalized.outcome.notes ?? null,
        snap.personal_hour.number,
        snap.personal_hour.quality,
        snap.personal_hour.is_master ? 1 : 0,
        snap.panchang.muhurta_score ?? null,
        snap.gg33.personal_day ?? null,
        snap.gg33.synergy ?? null,
        snap.combo_key,
        JSON.stringify(snap),
        JSON.stringify(normalized),
      ]
    );

    this.recompute(normalized.user_id);
  }

  getRules(userId: string): LearnedRule[] {
    const stmt = this.db.prepare(
      'SELECT id, rule_type, condition_json, effect_json, confidence, sample_count, active FROM learned_rule WHERE user_id = ? AND active = 1'
    );
    stmt.bind([userId]);
    const rules: LearnedRule[] = [];
    while (stmt.step()) {
      const row = stmt.getAsObject() as Record<string, string | number>;
      rules.push({
        id: String(row.id),
        rule_type: row.rule_type as LearnedRule['rule_type'],
        condition: JSON.parse(String(row.condition_json)),
        effect: JSON.parse(String(row.effect_json)),
        confidence: Number(row.confidence),
        sample_count: Number(row.sample_count),
        active: Boolean(row.active),
      });
    }
    stmt.free();
    return rules;
  }

  getAggregates(userId: string): PatternAggregate[] {
    const stmt = this.db.prepare(
      'SELECT aggregate_type, aggregate_key, sample_count, avg_outcome, success_rate, std_dev FROM pattern_aggregate WHERE user_id = ?'
    );
    stmt.bind([userId]);
    const aggregates: PatternAggregate[] = [];
    while (stmt.step()) {
      const row = stmt.getAsObject() as Record<string, string | number | null>;
      aggregates.push({
        aggregate_type: row.aggregate_type as PatternAggregate['aggregate_type'],
        aggregate_key: String(row.aggregate_key),
        sample_count: Number(row.sample_count),
        avg_outcome: Number(row.avg_outcome ?? 0),
        success_rate: Number(row.success_rate ?? 0),
        std_dev: row.std_dev != null ? Number(row.std_dev) : undefined,
      });
    }
    stmt.free();
    return aggregates;
  }

  /** Replace profile + logs and recompute aggregates (import / restore). */
  importState(userId: string, profile: UserProfile, logs: ActionLogEntry[]): void {
    this.db.run('DELETE FROM action_log WHERE user_id = ?', [userId]);
    this.db.run('DELETE FROM learned_rule WHERE user_id = ?', [userId]);
    this.db.run('DELETE FROM pattern_aggregate WHERE user_id = ?', [userId]);
    this.saveProfile(profile);
    for (const log of logs) {
      this.appendLogWithoutFlush(log);
    }
    this.recompute(userId);
  }

  async flush(): Promise<void> {
    await saveDbBytes(exportDatabase(this.db));
  }

  private recompute(userId: string): void {
    const profile = this.getProfile(userId);
    const logs = this.getLogs(userId);
    if (!profile) return;

    const { aggregates, rules, phase, hour_weights } = recomputeIntelligence(profile, logs);

    this.db.run('DELETE FROM pattern_aggregate WHERE user_id = ?', [userId]);
    for (const agg of aggregates) {
      this.db.run(
        `INSERT INTO pattern_aggregate (id, user_id, aggregate_type, aggregate_key, sample_count, avg_outcome, success_rate, std_dev)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          crypto.randomUUID(),
          userId,
          agg.aggregate_type,
          agg.aggregate_key,
          agg.sample_count,
          agg.avg_outcome,
          agg.success_rate,
          agg.std_dev ?? null,
        ]
      );
    }

    this.db.run('DELETE FROM learned_rule WHERE user_id = ?', [userId]);
    for (const rule of rules) {
      this.db.run(
        `INSERT INTO learned_rule (id, user_id, rule_type, condition_json, effect_json, confidence, sample_count, active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          rule.id,
          userId,
          rule.rule_type,
          JSON.stringify(rule.condition),
          JSON.stringify(rule.effect),
          rule.confidence,
          rule.sample_count,
          rule.active ? 1 : 0,
        ]
      );
    }

    this.saveProfile({
      ...profile,
      updated_at: new Date().toISOString(),
      personal_hours: {
        ...profile.personal_hours,
        learned_hour_weights: hour_weights,
        quality_tiers: {
          ...profile.personal_hours.quality_tiers,
          source: logs.length >= 8 ? 'learned' : profile.personal_hours.quality_tiers.source,
        },
      },
      intelligence_state: {
        last_computed_at: new Date().toISOString(),
        log_count: logs.length,
        phase,
        combo_scores: Object.fromEntries(
          aggregates.filter((a) => a.aggregate_type === 'combo').map((a) => [a.aggregate_key, a.avg_outcome])
        ),
      },
    });
  }

  private migrateFromLocalStorage(): string | null {
    try {
      const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (!raw) return null;
      const state = JSON.parse(raw) as LegacyPersistedState;
      this.saveProfile(state.profile);
      for (const log of state.logs) {
        this.appendLogWithoutFlush(log);
      }
      this.recompute(state.profile.id);
      localStorage.removeItem(LEGACY_STORAGE_KEY);
      return state.profile.id;
    } catch {
      return null;
    }
  }

  private appendLogWithoutFlush(entry: ActionLogEntry): void {
    const normalized: ActionLogEntry = {
      ...entry,
      outcome: { ...entry.outcome, success: entry.outcome.score >= 7 },
    };
    const snap = normalized.timing_snapshot;
    this.db.run(
      `INSERT OR IGNORE INTO action_log (
        id, user_id, schema_version, logged_at, action_at, action_summary, action_domain,
        tags_json, conviction_level, advisor_score, outcome_score, outcome_success, outcome_notes,
        ph_number, ph_quality, ph_is_master, muhurta_score, personal_day, zodiac_synergy,
        combo_key, snapshot_json, log_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        normalized.id,
        normalized.user_id,
        normalized.schema_version,
        normalized.logged_at,
        normalized.action_at,
        normalized.action.summary,
        normalized.action.domain ?? null,
        JSON.stringify(normalized.tags),
        normalized.conviction.level,
        Math.round(normalized.conviction.advisor_score),
        normalized.outcome.score,
        normalized.outcome.success ? 1 : 0,
        normalized.outcome.notes ?? null,
        snap.personal_hour.number,
        snap.personal_hour.quality,
        snap.personal_hour.is_master ? 1 : 0,
        snap.panchang.muhurta_score ?? null,
        snap.gg33.personal_day ?? null,
        snap.gg33.synergy ?? null,
        snap.combo_key,
        JSON.stringify(snap),
        JSON.stringify(normalized),
      ]
    );
  }
}