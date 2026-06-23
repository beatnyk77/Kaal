/**
 * Pattern Recognizer
 *
 * Phase 1: statistical aggregates + threshold-based rules (no ML deps)
 * Phase 2: Bayesian updates (placeholder hooks) — swap computeBayesianWeights()
 *
 * Minimum samples before promoting a rule: configurable (default 5)
 */

import type {
  ActionLogEntry,
  LearnedRule,
  PatternAggregate,
  PatternAdjustments,
  PatternPhase,
  UserProfile,
} from './types';

export interface PatternRecognizerConfig {
  minSamplesForRule: number;
  minSuccessRateBoost: number;   // e.g. 0.65
  maxSuccessRateAvoid: number;   // e.g. 0.35
  minAvgOutcomeBoost: number;      // e.g. 6.5
  maxAvgOutcomeAvoid: number;      // e.g. 4.0
  scoreDeltaPerRule: number;       // max ± per matched rule
  coldStartThreshold: number;      // logs below this = cold_start phase
}

export const DEFAULT_PATTERN_CONFIG: PatternRecognizerConfig = {
  minSamplesForRule: 5,
  minSuccessRateBoost: 0.65,
  maxSuccessRateAvoid: 0.35,
  minAvgOutcomeBoost: 6.5,
  maxAvgOutcomeAvoid: 4.0,
  scoreDeltaPerRule: 6,
  coldStartThreshold: 8,
};

function success(outcome: number): boolean {
  return outcome >= 7;
}

function mean(nums: number[]): number {
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
}

function stdDev(nums: number[]): number {
  if (nums.length < 2) return 0;
  const m = mean(nums);
  return Math.sqrt(nums.reduce((s, n) => s + (n - m) ** 2, 0) / (nums.length - 1));
}

/** Phase 1: recompute all aggregates from action logs */
export function computeAggregates(logs: ActionLogEntry[]): PatternAggregate[] {
  const byPh = new Map<number, number[]>();
  const byCombo = new Map<string, number[]>();
  const byDomainPh = new Map<string, number[]>();
  const byConviction = new Map<string, number[]>();

  for (const log of logs) {
    const o = log.outcome.score;
    const ph = log.timing_snapshot.personal_hour.number;
    const combo = log.timing_snapshot.combo_key;
    const domain = log.action.domain ?? 'other';
    const domPh = `${domain}:ph${ph}`;
    const conv = log.conviction.level;

    (byPh.get(ph) ?? byPh.set(ph, []).get(ph)!).push(o);
    (byCombo.get(combo) ?? byCombo.set(combo, []).get(combo)!).push(o);
    (byDomainPh.get(domPh) ?? byDomainPh.set(domPh, []).get(domPh)!).push(o);
    (byConviction.get(conv) ?? byConviction.set(conv, []).get(conv)!).push(o);
  }

  const agg = (type: PatternAggregate['aggregate_type'], key: string, outcomes: number[]): PatternAggregate => ({
    aggregate_type: type,
    aggregate_key: key,
    sample_count: outcomes.length,
    avg_outcome: mean(outcomes),
    success_rate: outcomes.filter(success).length / outcomes.length,
    std_dev: stdDev(outcomes),
  });

  const results: PatternAggregate[] = [];
  for (const [k, v] of byPh) results.push(agg('ph_hour', `ph:${k}`, v));
  for (const [k, v] of byCombo) results.push(agg('combo', k, v));
  for (const [k, v] of byDomainPh) results.push(agg('domain_ph', k, v));
  for (const [k, v] of byConviction) results.push(agg('conviction_band', k, v));

  return results;
}

/** Phase 1: promote aggregates into explicit learned rules */
export function deriveLearnedRules(
  aggregates: PatternAggregate[],
  config: PatternRecognizerConfig = DEFAULT_PATTERN_CONFIG
): LearnedRule[] {
  const rules: LearnedRule[] = [];
  let id = 0;

  for (const a of aggregates) {
    if (a.sample_count < config.minSamplesForRule) continue;

    const confidence = Math.min(1, a.sample_count / (config.minSamplesForRule * 3));

    if (a.aggregate_type === 'ph_hour') {
      const ph = Number(a.aggregate_key.replace('ph:', ''));
      if (a.success_rate >= config.minSuccessRateBoost && a.avg_outcome >= config.minAvgOutcomeBoost) {
        rules.push({
          id: `rule_${++id}`,
          rule_type: 'boost_ph',
          condition: { personal_hour: ph },
          effect: {
            score_delta: config.scoreDeltaPerRule,
            message: `Your logged outcomes in PH ${ph} average ${a.avg_outcome.toFixed(1)}/10 (${Math.round(a.success_rate * 100)}% success, n=${a.sample_count}).`,
          },
          confidence,
          sample_count: a.sample_count,
          active: true,
        });
      }
      if (a.success_rate <= config.maxSuccessRateAvoid && a.avg_outcome <= config.maxAvgOutcomeAvoid) {
        rules.push({
          id: `rule_${++id}`,
          rule_type: 'avoid_ph',
          condition: { personal_hour: ph },
          effect: {
            score_delta: -config.scoreDeltaPerRule,
            conviction_hint: 'downgrade',
            message: `PH ${ph} underperforms for you (${a.avg_outcome.toFixed(1)}/10 avg, n=${a.sample_count}).`,
          },
          confidence,
          sample_count: a.sample_count,
          active: true,
        });
      }
    }

    if (a.aggregate_type === 'domain_ph' && a.success_rate >= config.minSuccessRateBoost) {
      const [domain, phPart] = a.aggregate_key.split(':');
      const ph = Number(phPart.replace('ph', ''));
      rules.push({
        id: `rule_${++id}`,
        rule_type: 'domain_hint',
        condition: { domain, personal_hour: ph },
        effect: {
          score_delta: Math.round(config.scoreDeltaPerRule * 0.8),
          message: `${domain} actions in PH ${ph}: ${Math.round(a.success_rate * 100)}% success (n=${a.sample_count}).`,
        },
        confidence,
        sample_count: a.sample_count,
        active: true,
      });
    }

    if (a.aggregate_type === 'combo' && a.sample_count >= config.minSamplesForRule * 2) {
      if (a.avg_outcome >= config.minAvgOutcomeBoost) {
        rules.push({
          id: `rule_${++id}`,
          rule_type: 'boost_combo',
          condition: { combo_key: a.aggregate_key },
          effect: {
            score_delta: config.scoreDeltaPerRule,
            message: `Strong combo for you: ${a.aggregate_key} → ${a.avg_outcome.toFixed(1)}/10 (n=${a.sample_count}).`,
          },
          confidence,
          sample_count: a.sample_count,
          active: true,
        });
      }
    }
  }

  return rules;
}

/** Phase 2 hook — Bayesian hour weights from Beta(α,β) per PH */
export function computeBayesianHourWeights(
  logs: ActionLogEntry[],
  priorAlpha = 2,
  priorBeta = 2
): Record<number, number> {
  const weights: Record<number, number> = {};
  const byPh = new Map<number, { wins: number; losses: number }>();

  for (const log of logs) {
    const ph = log.timing_snapshot.personal_hour.number;
    const bucket = byPh.get(ph) ?? { wins: 0, losses: 0 };
    if (success(log.outcome.score)) bucket.wins++;
    else bucket.losses++;
    byPh.set(ph, bucket);
  }

  for (const [ph, { wins, losses }] of byPh) {
    const alpha = priorAlpha + wins;
    const beta = priorBeta + losses;
    const posteriorMean = alpha / (alpha + beta);
    weights[ph] = Math.round((posteriorMean - 0.5) * 2 * 100) / 100; // map to -1..+1
  }

  return weights;
}

export function determinePhase(logCount: number, config = DEFAULT_PATTERN_CONFIG): PatternPhase {
  if (logCount < config.coldStartThreshold) return 'cold_start';
  if (logCount < 40) return 'phase1_rules';
  return 'phase2_bayesian';
}

/** Full recompute pipeline after log ingest */
export function recomputeIntelligence(
  _profile: UserProfile,
  logs: ActionLogEntry[],
  config = DEFAULT_PATTERN_CONFIG
): {
  aggregates: PatternAggregate[];
  rules: LearnedRule[];
  phase: PatternPhase;
  hour_weights: Record<string, number>;
} {
  const aggregates = computeAggregates(logs);
  const rules = deriveLearnedRules(aggregates, config);
  const phase = determinePhase(logs.length, config);
  const hour_weights =
    phase === 'phase2_bayesian'
      ? Object.fromEntries(
          Object.entries(computeBayesianHourWeights(logs)).map(([k, v]) => [k, v])
        )
      : {};

  return { aggregates, rules, phase, hour_weights };
}

/** Apply learned rules to a live advisor context */
export function getPatternAdjustments(input: {
  personalHour: number;
  comboKey: string;
  domain?: string;
  rules: LearnedRule[];
  hourWeights?: Record<string, number>;
  phase: PatternPhase;
  logCount: number;
}): PatternAdjustments {
  const messages: string[] = [];
  const matched: LearnedRule[] = [];
  let score_delta = 0;

  for (const rule of input.rules.filter((r) => r.active)) {
    const c = rule.condition;
    let match = false;

    if (rule.rule_type === 'boost_ph' || rule.rule_type === 'avoid_ph') {
      match = c.personal_hour === input.personalHour;
    } else if (rule.rule_type === 'boost_combo') {
      match = c.combo_key === input.comboKey;
    } else if (rule.rule_type === 'domain_hint') {
      match = c.personal_hour === input.personalHour && c.domain === input.domain;
    }

    if (match) {
      matched.push(rule);
      score_delta += rule.effect.score_delta * rule.confidence;
      messages.push(rule.effect.message);
    }
  }

  if (input.hourWeights) {
    const w = input.hourWeights[String(input.personalHour)];
    if (w !== undefined) {
      const scale = input.phase === 'phase2_bayesian' ? 8 : 12;
      score_delta += Math.round(w * scale);
      const label = input.phase === 'phase2_bayesian' ? 'Bayesian' : 'Cold-start prior';
      messages.push(`${label} PH ${input.personalHour} weight: ${w > 0 ? '+' : ''}${w.toFixed(2)}`);
    }
  }

  let conviction_hint: PatternAdjustments['conviction_hint'];
  if (score_delta >= 5) conviction_hint = 'upgrade';
  else if (score_delta <= -5) conviction_hint = 'downgrade';

  return {
    score_delta: Math.round(score_delta),
    conviction_hint,
    messages,
    matched_rules: matched,
    phase: input.phase,
    sample_size: input.logCount,
  };
}