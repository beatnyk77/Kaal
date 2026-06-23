/**
 * Feedback Bridge — connects pattern layer → hybrid advisor
 */

import type { HybridAdvisorResponse } from '../hybridTimingAdvisor';
import type { PatternAdjustments, ActionLogEntry, LearnedRule, UserProfile } from './types';
import { getPatternAdjustments, determinePhase } from './patternRecognizer';
import { comboKeyFromSnapshot } from './comboKey';

export interface EnrichedAdvisorResponse extends HybridAdvisorResponse {
  pattern: {
    adjustments: PatternAdjustments;
    adjusted_conviction: {
      level: HybridAdvisorResponse['conviction']['level'];
      score: number;
      delta_from_learning: number;
    };
    insights: string[];
  };
}

export function applyPatternAdjustments(
  advice: HybridAdvisorResponse,
  adjustments: PatternAdjustments
): EnrichedAdvisorResponse {
  let score = advice.conviction.score + adjustments.score_delta;
  score = Math.max(10, Math.min(95, score));

  let level = advice.conviction.level;
  if (adjustments.conviction_hint === 'upgrade') {
    if (score >= 72) level = 'High';
    else if (score >= 52) level = 'Medium';
  } else if (adjustments.conviction_hint === 'downgrade') {
    if (score < 52) level = 'Low';
    else if (score < 72) level = 'Medium';
  } else {
    if (score >= 72) level = 'High';
    else if (score >= 52) level = 'Medium';
    else level = 'Low';
  }

  const insights =
    adjustments.phase === 'cold_start'
      ? ['Log more actions to unlock personalized timing patterns (need ~8 entries).']
      : adjustments.messages;

  return {
    ...advice,
    conviction: {
      ...advice.conviction,
      level,
      score,
      summary: `${advice.conviction.summary} · Learning ${adjustments.score_delta >= 0 ? '+' : ''}${adjustments.score_delta} (n=${adjustments.sample_size})`,
    },
    patternNote: {
      status: 'placeholder',
      message:
        adjustments.phase === 'cold_start'
          ? 'Cold start — using default arthouse33 weights only.'
          : `Active learning (${adjustments.phase}): ${adjustments.matched_rules.length} rule(s) applied.`,
      futureFields: advice.patternNote.futureFields,
    },
    synthesis: {
      ...advice.synthesis,
      dos: [...adjustments.messages.filter((m) => !m.includes('underperform')), ...advice.synthesis.dos].slice(0, 8),
      donts: [
        ...adjustments.messages.filter((m) => m.includes('underperform') || m.includes('avoid')),
        ...advice.synthesis.donts,
      ].slice(0, 8),
    },
    pattern: {
      adjustments,
      adjusted_conviction: {
        level,
        score,
        delta_from_learning: adjustments.score_delta,
      },
      insights,
    },
  };
}

export function buildPatternContext(
  advice: HybridAdvisorResponse,
  profile: UserProfile,
  logs: ActionLogEntry[],
  rules: LearnedRule[],
  hourWeights?: Record<string, number>
): PatternAdjustments {
  const snapshot = {
    timezone_offset_minutes: advice.meta.timezoneOffsetMinutes,
    personal_hour: {
      number: advice.personalHour.personalHour,
      quality: advice.personalHour.quality,
      is_master: advice.personalHour.isMaster,
    },
    panchang: {
      tithi: advice.panchang.tithi.name,
      tithi_phase: advice.panchang.tithi.phase,
      nakshatra: advice.panchang.nakshatra.name,
      yoga: advice.panchang.yoga.name,
      vara: advice.panchang.vara,
      muhurta_score: advice.panchang.muhurta.score,
    },
    gg33: {
      personal_year: advice.gg33.personalYear,
      personal_day: advice.gg33.personalDay,
      synergy: advice.gg33.synergy,
    },
    combo_key: '',
  };
  snapshot.combo_key = comboKeyFromSnapshot(snapshot, profile.preferences.primary_domains?.[0]);

  return getPatternAdjustments({
    personalHour: advice.personalHour.personalHour,
    comboKey: snapshot.combo_key,
    domain: profile.preferences.primary_domains?.[0],
    rules,
    hourWeights: hourWeights ?? profile.personal_hours.learned_hour_weights,
    phase: profile.intelligence_state?.phase ?? determinePhase(logs.length),
    logCount: logs.length,
  });
}