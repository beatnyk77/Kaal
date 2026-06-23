import { describe, it, expect, beforeEach } from 'vitest';
import {
  MemoryIntelligenceStore,
  computeAggregates,
  deriveLearnedRules,
  buildIntelligenceDashboard,
  createKartikayProfile,
  comboKeyFromSnapshot,
} from './index';
import type { ActionLogEntry } from './types';

function makeLog(ph: number, outcome: number, domain = 'deal'): ActionLogEntry {
  const snapshot = {
    timezone_offset_minutes: 330,
    personal_hour: { number: ph, quality: 'best' as const, is_master: ph > 9 },
    panchang: {
      tithi: 'Shukla Panchami',
      nakshatra: 'Rohini',
      yoga: 'Siddhi',
      vara: 'Thursday',
      muhurta_score: 70,
    },
    gg33: { personal_year: 3, personal_day: 8, synergy: 'friendly' as const },
    combo_key: '',
  };
  snapshot.combo_key = comboKeyFromSnapshot(snapshot, domain);

  return {
    id: crypto.randomUUID(),
    user_id: 'kartikay-default',
    schema_version: '1.0.0',
    logged_at: new Date().toISOString(),
    action_at: new Date().toISOString(),
    action: { summary: `Test ${domain}`, domain: domain as 'deal' },
    tags: [domain],
    conviction: { level: 'High', advisor_score: 80 },
    outcome: { score: outcome },
    timing_snapshot: snapshot,
  };
}

describe('User Intelligence Layer', () => {
  let store: MemoryIntelligenceStore;

  beforeEach(() => {
    store = new MemoryIntelligenceStore();
    store.saveProfile(createKartikayProfile());
  });

  it('computes PH success rate comparisons', () => {
    const logs = [
      ...Array.from({ length: 6 }, () => makeLog(8, 9)),
      ...Array.from({ length: 6 }, () => makeLog(5, 3)),
    ];
    logs.forEach((l) => store.appendLog(l));

    const dash = buildIntelligenceDashboard(store.getLogs('kartikay-default'));
    expect(dash.ph_comparisons[0].personal_hour).toBe(8);
    expect(dash.ph_comparisons[0].success_rate).toBeGreaterThan(0.8);
    expect(dash.insights.some((i) => i.includes('PH 8'))).toBe(true);
  });

  it('derives boost rule for high-performing PH', () => {
    const logs = Array.from({ length: 6 }, () => makeLog(8, 8));
    const aggs = computeAggregates(logs);
    const rules = deriveLearnedRules(aggs);
    expect(rules.some((r) => r.rule_type === 'boost_ph' && r.condition.personal_hour === 8)).toBe(true);
  });

  it('recomputes on log ingest', () => {
    for (let i = 0; i < 10; i++) store.appendLog(makeLog(8, 8));
    const profile = store.getProfile('kartikay-default')!;
    expect(profile.intelligence_state?.log_count).toBe(10);
    expect(profile.intelligence_state?.phase).toBe('phase1_rules');
    expect(store.getRules('kartikay-default').length).toBeGreaterThan(0);
  });
});