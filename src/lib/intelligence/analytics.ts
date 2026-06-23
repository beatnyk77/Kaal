/**
 * Intelligence Analytics — queries & metrics surfaced to the user
 */

import type { ActionLogEntry } from './types';
import { computeAggregates } from './patternRecognizer';

export interface PhComparisonMetric {
  personal_hour: number;
  sample_count: number;
  avg_outcome: number;
  success_rate: number;
  vs_global_avg: number;
}

export interface DomainComboMetric {
  domain: string;
  combo_key: string;
  personal_hour: number;
  sample_count: number;
  avg_outcome: number;
  success_rate: number;
  rank: number;
}

export interface IntelligenceDashboard {
  total_logs: number;
  overall_avg_outcome: number;
  overall_success_rate: number;
  ph_comparisons: PhComparisonMetric[];
  best_ph_for_deals: PhComparisonMetric | null;
  worst_ph_for_deals: PhComparisonMetric | null;
  top_combos_by_domain: Record<string, DomainComboMetric[]>;
  conviction_calibration: {
    high_avg_outcome: number | null;
    medium_avg_outcome: number | null;
    low_avg_outcome: number | null;
    advisor_trust_score: number | null;
  };
  insights: string[];
}

function filterByTag(logs: ActionLogEntry[], tag: string): ActionLogEntry[] {
  return logs.filter((l) => l.tags.includes(tag) || l.action.domain === tag);
}

export function comparePersonalHours(logs: ActionLogEntry[]): PhComparisonMetric[] {
  const aggregates = computeAggregates(logs).filter((a) => a.aggregate_type === 'ph_hour');
  const globalAvg = logs.length
    ? logs.reduce((s, l) => s + l.outcome.score, 0) / logs.length
    : 0;

  return aggregates
    .map((a) => ({
      personal_hour: Number(a.aggregate_key.replace('ph:', '')),
      sample_count: a.sample_count,
      avg_outcome: a.avg_outcome,
      success_rate: a.success_rate,
      vs_global_avg: a.avg_outcome - globalAvg,
    }))
    .sort((a, b) => b.avg_outcome - a.avg_outcome);
}

export function bestCombosForDomain(
  logs: ActionLogEntry[],
  domain: string,
  topN = 5
): DomainComboMetric[] {
  const domainLogs = filterByTag(logs, domain);
  const aggregates = computeAggregates(domainLogs).filter((a) => a.aggregate_type === 'combo');

  return aggregates
    .map((a, i) => ({
      domain,
      combo_key: a.aggregate_key,
      personal_hour: extractPhFromCombo(a.aggregate_key),
      sample_count: a.sample_count,
      avg_outcome: a.avg_outcome,
      success_rate: a.success_rate,
      rank: i + 1,
    }))
    .sort((a, b) => b.avg_outcome - a.avg_outcome)
    .slice(0, topN)
    .map((m, i) => ({ ...m, rank: i + 1 }));
}

function extractPhFromCombo(key: string): number {
  const m = key.match(/ph(\d+)/);
  return m ? Number(m[1]) : 0;
}

export function buildIntelligenceDashboard(logs: ActionLogEntry[]): IntelligenceDashboard {
  const phAll = comparePersonalHours(logs);
  const dealLogs = filterByTag(logs, 'deal');
  const dealPh = comparePersonalHours(dealLogs);

  const topCombos: Record<string, DomainComboMetric[]> = {};
  for (const domain of ['deal', 'trading', 'launch', 'health', 'meetings']) {
    const combos = bestCombosForDomain(logs, domain, 3);
    if (combos.length) topCombos[domain] = combos;
  }

  const convAgg = computeAggregates(logs).filter((a) => a.aggregate_type === 'conviction_band');
  const convMap = Object.fromEntries(convAgg.map((a) => [a.aggregate_key, a.avg_outcome]));

  const followed = logs.filter((l) => l.action.followed_advisor);
  const advisorTrust =
    followed.length >= 3
      ? followed.reduce((s, l) => s + l.outcome.score, 0) / followed.length -
        logs.filter((l) => !l.action.followed_advisor).reduce((s, l) => s + l.outcome.score, 0) /
          Math.max(1, logs.filter((l) => !l.action.followed_advisor).length)
      : null;

  const insights: string[] = [];
  if (phAll.length >= 2) {
    const best = phAll[0];
    const worst = phAll[phAll.length - 1];
    insights.push(
      `Your success rate in PH ${best.personal_hour} hours (${Math.round(best.success_rate * 100)}%) vs PH ${worst.personal_hour} (${Math.round(worst.success_rate * 100)}%).`
    );
  }
  if (dealPh.length) {
    insights.push(
      `Best PH for deal-making: ${dealPh[0].personal_hour} (avg ${dealPh[0].avg_outcome.toFixed(1)}/10, n=${dealPh[0].sample_count}).`
    );
  }
  if (topCombos.deal?.[0]) {
    insights.push(`Top deal combo: ${topCombos.deal[0].combo_key} → ${topCombos.deal[0].avg_outcome.toFixed(1)}/10.`);
  }

  return {
    total_logs: logs.length,
    overall_avg_outcome: logs.length ? logs.reduce((s, l) => s + l.outcome.score, 0) / logs.length : 0,
    overall_success_rate: logs.length ? logs.filter((l) => l.outcome.score >= 7).length / logs.length : 0,
    ph_comparisons: phAll,
    best_ph_for_deals: dealPh[0] ?? null,
    worst_ph_for_deals: dealPh.length ? dealPh[dealPh.length - 1] : null,
    top_combos_by_domain: topCombos,
    conviction_calibration: {
      high_avg_outcome: convMap.High ?? null,
      medium_avg_outcome: convMap.Medium ?? null,
      low_avg_outcome: convMap.Low ?? null,
      advisor_trust_score: advisorTrust,
    },
    insights,
  };
}

/** SQL query templates for SQLite / Postgres (parameterized) */
export const ANALYTICS_QUERIES = {
  phSuccessRates: `
    SELECT ph_number, COUNT(*) AS n,
           AVG(outcome_score) AS avg_outcome,
           SUM(outcome_success) * 1.0 / COUNT(*) AS success_rate
    FROM action_log WHERE user_id = ? GROUP BY ph_number ORDER BY avg_outcome DESC`,

  domainPhPerformance: `
    SELECT action_domain, ph_number, COUNT(*) AS n, AVG(outcome_score) AS avg_outcome
    FROM action_log WHERE user_id = ? AND action_domain IS NOT NULL
    GROUP BY action_domain, ph_number HAVING n >= 3 ORDER BY avg_outcome DESC`,

  topCombos: `
    SELECT combo_key, COUNT(*) AS n, AVG(outcome_score) AS avg_outcome
    FROM action_log WHERE user_id = ? GROUP BY combo_key HAVING n >= 5
    ORDER BY avg_outcome DESC LIMIT 10`,

  convictionCalibration: `
    SELECT conviction_level, AVG(outcome_score) AS avg_outcome, COUNT(*) AS n
    FROM action_log WHERE user_id = ? GROUP BY conviction_level`,

  recentTrend: `
    SELECT date(action_at) AS day, AVG(outcome_score) AS avg_outcome, COUNT(*) AS n
    FROM action_log WHERE user_id = ? AND action_at >= datetime('now', '-30 days')
    GROUP BY day ORDER BY day`,
} as const;