/**
 * User Intelligence Layer — core types
 * Mirrors user_profile.schema.json + action_log.schema.json
 */

import type { PersonalHourQuality } from '../panchangJS/personalHours';
import type { ConvictionLevel } from '../hybridTimingAdvisor';

export type ActionDomain = 'deal' | 'trading' | 'launch' | 'health' | 'creative' | 'meetings' | 'build' | 'other';
export type ActionTag = ActionDomain | string;
export type StorageMode = 'local_only' | 'encrypted_sync' | 'cloud_opt_in';
export type PatternPhase = 'cold_start' | 'phase1_rules' | 'phase2_bayesian';

export interface UserProfile {
  id: string;
  schema_version: string;
  created_at: string;
  updated_at: string;
  identity: { display_name: string; email?: string };
  birth: {
    date: string;
    time: string;
    timezone_offset_minutes: number;
    place_name?: string;
  };
  numerology: {
    core_number: number;
    life_path?: number;
    btn: number;
    gg33: { birth_month: number; birth_day: number; birth_year: number; year_animal?: string };
  };
  personal_hours: {
    transition_minute: number;
    calibration_offset?: number;
    quality_tiers: {
      best: number[];
      friendly: number[];
      caution: number[];
      source?: 'arthouse33_default' | 'user_override' | 'learned';
    };
    learned_hour_weights?: Record<string, number>;
  };
  location: {
    latitude: number;
    longitude: number;
    timezone_offset_minutes: number;
    city?: string;
    country_code?: string;
  };
  preferences: {
    primary_domains?: ActionDomain[];
    conviction_sensitivity?: 'conservative' | 'balanced' | 'aggressive';
    hybrid_weights_override?: Record<string, unknown>;
    privacy: {
      storage_mode: StorageMode;
      share_anonymized_patterns?: boolean;
      retention_days?: number;
    };
  };
  intelligence_state?: {
    last_computed_at?: string;
    log_count?: number;
    phase?: PatternPhase;
    combo_scores?: Record<string, number>;
  };
}

export interface TimingSnapshot {
  timezone_offset_minutes: number;
  personal_hour: {
    number: number;
    quality: PersonalHourQuality;
    is_master: boolean;
    hour_count?: number;
    window_start?: string;
  };
  panchang: {
    tithi: string;
    tithi_phase?: 'shukla' | 'krishna' | 'unknown';
    nakshatra: string;
    yoga: string;
    vara: string;
    muhurta_score: number;
  };
  gg33: {
    personal_year: number;
    personal_day: number;
    daily_number?: number;
    synergy: 'friendly' | 'neutral' | 'enemy' | 'self';
    day_animal?: string;
  };
  jyotish?: { dasha_maha?: string; dasha_antar?: string; score?: number };
  combo_key: string;
}

export interface ActionLogEntry {
  id: string;
  user_id: string;
  schema_version: string;
  logged_at: string;
  action_at: string;
  action: {
    summary: string;
    domain?: ActionDomain;
    followed_advisor?: boolean;
  };
  tags: string[];
  conviction: {
    level: ConvictionLevel;
    advisor_score: number;
    advisor_summary?: string;
  };
  outcome: {
    score: number;
    success?: boolean;
    notes?: string;
    recorded_at?: string;
  };
  timing_snapshot: TimingSnapshot;
  pattern_feedback?: { weight_delta_applied?: number; matched_learned_rule?: string };
}

/** Materialized aggregate row */
export interface PatternAggregate {
  aggregate_type: 'ph_hour' | 'combo' | 'domain_ph' | 'conviction_band';
  aggregate_key: string;
  sample_count: number;
  avg_outcome: number;
  success_rate: number;
  std_dev?: number;
}

/** Rule promoted from Phase 1 aggregates */
export interface LearnedRule {
  id: string;
  rule_type: 'boost_ph' | 'avoid_ph' | 'boost_combo' | 'domain_hint';
  condition: Record<string, unknown>;
  effect: {
    score_delta: number;
    conviction_hint?: string;
    message: string;
  };
  confidence: number;
  sample_count: number;
  active: boolean;
}

/** Feedback injected into hybrid advisor */
export interface PatternAdjustments {
  score_delta: number;
  conviction_hint?: 'upgrade' | 'downgrade' | 'hold';
  personal_hour_bias?: Record<number, number>;
  messages: string[];
  matched_rules: LearnedRule[];
  phase: PatternPhase;
  sample_size: number;
}