/**
 * In-memory intelligence store (local-first dev default).
 * Swap for SQLiteStore / PostgresStore implementing IntelligenceStore.
 */

import type { ActionLogEntry, LearnedRule, PatternAggregate, UserProfile } from './types';
import { recomputeIntelligence } from './patternRecognizer';

export interface IntelligenceStore {
  getProfile(userId: string): UserProfile | undefined;
  saveProfile(profile: UserProfile): void;
  getLogs(userId: string): ActionLogEntry[];
  appendLog(entry: ActionLogEntry): void;
  getRules(userId: string): LearnedRule[];
  getAggregates(userId: string): PatternAggregate[];
}

export class MemoryIntelligenceStore implements IntelligenceStore {
  private profiles = new Map<string, UserProfile>();
  private logs = new Map<string, ActionLogEntry[]>();
  private rules = new Map<string, LearnedRule[]>();
  private aggregates = new Map<string, PatternAggregate[]>();

  getProfile(userId: string) {
    return this.profiles.get(userId);
  }

  saveProfile(profile: UserProfile) {
    this.profiles.set(profile.id, profile);
  }

  getLogs(userId: string) {
    return this.logs.get(userId) ?? [];
  }

  appendLog(entry: ActionLogEntry) {
    const list = this.logs.get(entry.user_id) ?? [];
    list.push({ ...entry, outcome: { ...entry.outcome, success: entry.outcome.score >= 7 } });
    this.logs.set(entry.user_id, list);
    this.recompute(entry.user_id);
  }

  /** Bulk load persisted state without duplicate recompute per row */
  importState(userId: string, profile: UserProfile, logs: ActionLogEntry[]) {
    this.profiles.set(userId, profile);
    this.logs.set(userId, logs.map((e) => ({
      ...e,
      outcome: { ...e.outcome, success: e.outcome.score >= 7 },
    })));
    this.recompute(userId);
  }

  getRules(userId: string) {
    return this.rules.get(userId) ?? [];
  }

  getAggregates(userId: string) {
    return this.aggregates.get(userId) ?? [];
  }

  private recompute(userId: string) {
    const profile = this.profiles.get(userId);
    const logs = this.getLogs(userId);
    if (!profile) return;

    const { aggregates, rules, phase, hour_weights } = recomputeIntelligence(profile, logs);
    this.aggregates.set(userId, aggregates);
    this.rules.set(userId, rules);

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
}

/** Singleton for app session — replace with SQLite path in production */
export const defaultIntelligenceStore = new MemoryIntelligenceStore();