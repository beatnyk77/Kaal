import type { HybridAdvisorResponse } from '../hybridTimingAdvisor';
import type { EnrichedAdvisorResponse } from './feedbackBridge';
import type { ActionDomain, ActionLogEntry, TimingSnapshot } from './types';
import { comboKeyFromSnapshot } from './comboKey';

export function buildTimingSnapshotFromAdvice(
  advice: HybridAdvisorResponse | EnrichedAdvisorResponse,
  domain?: ActionDomain
): TimingSnapshot {
  const snapshot: TimingSnapshot = {
    timezone_offset_minutes: advice.meta.timezoneOffsetMinutes,
    personal_hour: {
      number: advice.personalHour.personalHour,
      quality: advice.personalHour.quality,
      is_master: advice.personalHour.isMaster,
      hour_count: advice.personalHour.hourCount,
      window_start: advice.personalHour.windowStart,
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
      daily_number: advice.gg33.dailyNumber,
      synergy: advice.gg33.synergy,
      day_animal: advice.gg33.dayAnimal,
    },
    jyotish: {
      dasha_maha: advice.jyotish.dasha.maha,
      dasha_antar: advice.jyotish.dasha.antar,
      score: advice.jyotish.score,
    },
    combo_key: '',
  };
  snapshot.combo_key = comboKeyFromSnapshot(snapshot, domain);
  return snapshot;
}

export function buildActionLogEntry(input: {
  userId: string;
  advice: EnrichedAdvisorResponse;
  summary: string;
  domain: ActionDomain;
  tags: string[];
  outcomeScore: number;
  notes?: string;
  followedAdvisor?: boolean;
  actionAt?: Date;
}): ActionLogEntry {
  const now = new Date().toISOString();
  const snapshot = buildTimingSnapshotFromAdvice(input.advice, input.domain);

  return {
    id: crypto.randomUUID(),
    user_id: input.userId,
    schema_version: '1.0.0',
    logged_at: now,
    action_at: (input.actionAt ?? new Date()).toISOString(),
    action: {
      summary: input.summary,
      domain: input.domain,
      followed_advisor: input.followedAdvisor ?? true,
    },
    tags: input.tags,
    conviction: {
      level: input.advice.conviction.level,
      advisor_score: input.advice.conviction.score,
      advisor_summary: input.advice.conviction.summary,
    },
    outcome: {
      score: input.outcomeScore,
      success: input.outcomeScore >= 7,
      notes: input.notes,
      recorded_at: now,
    },
    timing_snapshot: snapshot,
  };
}