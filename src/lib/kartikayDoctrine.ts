/**
 * Kartikay personal timing doctrine — loader and merge helpers
 */

import doctrineJson from '../data/kartikay_doctrine.json';
import type { PersonalHourResult } from './panchangJS/personalHours';
import type { ConvictionLevel, HybridScoringWeights } from './hybridTimingAdvisor';

export interface PhGateConfig {
  high_conviction_only_on: Array<'best' | 'master' | 'friendly' | 'caution' | 'neutral'>;
  suppression_message: string;
}

export interface KartikayDoctrine {
  meta: {
    id: string;
    version: string;
    owner: string;
    core_number: number;
    description: string;
  };
  ph_gate: PhGateConfig;
  conviction_sensitivity: 'conservative' | 'balanced' | 'aggressive';
  hybrid_weights_override: Record<string, unknown>;
  cold_start_priors: {
    learned_hour_weights: Record<string, number>;
    tag_affinities: Record<string, number[]>;
  };
  chart_overlays: {
    lagna: { sign: string; notes: string };
    moon: { sign: string; notes: string };
  };
}

export interface PhGateResult {
  level: ConvictionLevel;
  suppressed: boolean;
  message: string | null;
  rawLevel: ConvictionLevel;
}

export const KARTIKAY_DOCTRINE: KartikayDoctrine = doctrineJson as KartikayDoctrine;

const SENSITIVITY_THRESHOLDS: Record<
  KartikayDoctrine['conviction_sensitivity'],
  { high: number; medium: number }
> = {
  conservative: { high: 75, medium: 55 },
  balanced: { high: 72, medium: 52 },
  aggressive: { high: 68, medium: 48 },
};

function deepMergeWeights(
  base: HybridScoringWeights,
  override: Record<string, unknown>
): HybridScoringWeights {
  const merged = structuredClone(base);

  const ph = override.personalHour as Partial<HybridScoringWeights['personalHour']> | undefined;
  if (ph) {
    merged.personalHour = { ...merged.personalHour, ...ph };
  }

  const pan = override.panchang as Partial<HybridScoringWeights['panchang']> | undefined;
  if (pan) merged.panchang = { ...merged.panchang, ...pan };

  const gg = override.gg33 as Partial<HybridScoringWeights['gg33']> | undefined;
  if (gg) merged.gg33 = { ...merged.gg33, ...gg };

  const jy = override.jyotish as Partial<HybridScoringWeights['jyotish']> | undefined;
  if (jy) merged.jyotish = { ...merged.jyotish, ...jy };

  const cross = override.crossSystem as Partial<HybridScoringWeights['crossSystem']> | undefined;
  if (cross) merged.crossSystem = { ...merged.crossSystem, ...cross };

  const thresholds = override.convictionThresholds as
    | Partial<HybridScoringWeights['convictionThresholds']>
    | undefined;
  if (thresholds) {
    merged.convictionThresholds = { ...merged.convictionThresholds, ...thresholds };
  }

  return merged;
}

export function resolveDoctrineWeights(
  base: HybridScoringWeights,
  doctrine: KartikayDoctrine = KARTIKAY_DOCTRINE,
  profileOverride?: Record<string, unknown>
): HybridScoringWeights {
  let weights = deepMergeWeights(base, doctrine.hybrid_weights_override);

  const sensitivity = doctrine.conviction_sensitivity;
  weights.convictionThresholds = {
    ...weights.convictionThresholds,
    ...SENSITIVITY_THRESHOLDS[sensitivity],
  };

  if (profileOverride) {
    weights = deepMergeWeights(weights, profileOverride);
  }

  return weights;
}

export function passesPhGate(ph: Pick<PersonalHourResult, 'quality' | 'isMaster'>, gate: PhGateConfig): boolean {
  const allowed = gate.high_conviction_only_on;
  if (allowed.includes('master') && ph.isMaster) return true;
  if (allowed.includes('best') && ph.quality === 'best') return true;
  return false;
}

export function applyPhGate(
  ph: Pick<PersonalHourResult, 'personalHour' | 'quality' | 'isMaster'>,
  rawLevel: ConvictionLevel,
  gate: PhGateConfig = KARTIKAY_DOCTRINE.ph_gate
): PhGateResult {
  if (rawLevel !== 'High' || passesPhGate(ph, gate)) {
    return { level: rawLevel, suppressed: false, message: null, rawLevel };
  }

  const message = gate.suppression_message
    .replace('{ph}', String(ph.personalHour))
    .replace('{quality}', ph.quality);

  return {
    level: 'Medium',
    suppressed: true,
    message,
    rawLevel,
  };
}

export function formatPhGateMessage(result: PhGateResult): string | null {
  return result.suppressed ? result.message : null;
}

export function seedLearnedHourWeights(
  doctrine: KartikayDoctrine = KARTIKAY_DOCTRINE
): Record<string, number> {
  return { ...doctrine.cold_start_priors.learned_hour_weights };
}

export function doctrinePreferencesFromKartikay(
  doctrine: KartikayDoctrine = KARTIKAY_DOCTRINE
): {
  conviction_sensitivity: KartikayDoctrine['conviction_sensitivity'];
  hybrid_weights_override: Record<string, unknown>;
} {
  return {
    conviction_sensitivity: doctrine.conviction_sensitivity,
    hybrid_weights_override: doctrine.hybrid_weights_override,
  };
}

/** Extra PH scoring deltas from Core-4-friendly / caution number lists in doctrine */
export function doctrinePersonalHourExtras(
  ph: PersonalHourResult,
  weights: HybridScoringWeights['personalHour']
): { delta: number; label: string | null } {
  const phWeights = weights as HybridScoringWeights['personalHour'] & {
    core4_friendly_numbers?: number[];
    core4_friendly_bonus?: number;
    caution_numbers?: number[];
    caution_extra_penalty?: number;
  };

  if (
    phWeights.core4_friendly_numbers?.includes(ph.personalHour) &&
    phWeights.core4_friendly_bonus
  ) {
    return {
      delta: phWeights.core4_friendly_bonus,
      label: `Core-4-friendly PH ${ph.personalHour}`,
    };
  }

  if (phWeights.caution_numbers?.includes(ph.personalHour) && phWeights.caution_extra_penalty) {
    return {
      delta: phWeights.caution_extra_penalty,
      label: `Core-4-caution PH ${ph.personalHour}`,
    };
  }

  return { delta: 0, label: null };
}