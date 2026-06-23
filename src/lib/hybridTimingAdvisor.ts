/**
 * Hybrid Timing Advisor
 *
 * Merges Personal Hours + Panchang + Jyotish + GG33 into one transparent,
 * tunable recommendation for any datetime + user birth profile.
 */

import {
  calculatePersonalHour,
  DEFAULT_PERSONAL_HOUR_PROFILE,
  IST_OFFSET_MINUTES,
  type PersonalHourResult,
  type PersonalHourQuality,
} from './panchangJS/personalHours';
import { getPanchang, type PanchangData, type TithiPhase } from './panchangAdapter';
import { getJyotishContext, type BirthChartProfile, type JyotishContext, type JyotishAdapterOptions } from './jyotishAdapter';
import { calculateDailyNumerology, type GG33Profile, type DailyNumerology } from './gg33Viet';
import {
  getNumberProfile,
  getNumberCompatibility,
  getPersonalYearPhase,
  evaluateCrossSystem,
  type CompatibilityLevel,
} from './masterNumerology';
import {
  applyPhGate,
  doctrinePersonalHourExtras,
  resolveDoctrineWeights,
  type KartikayDoctrine,
  type PhGateResult,
} from './kartikayDoctrine';

// ─── Tunable weights (first-principles defaults) ───────────────────────────

/**
 * Scoring philosophy:
 * - Personal Hour (35%): birth-anchored hourly signal — highest for intraday action timing
 * - Panchang (25%): traditional muhurta quality — validated for auspicious windows
 * - GG33 (20%): personal numerology + zodiac — daily/macro resonance
 * - Jyotish (20%): dasha/transit context — natal background, modulates not overrides PH
 *
 * Base score 50 = neutral. Contributions are additive deltas with documented caps.
 */
export interface HybridScoringWeights {
  personalHour: {
    best: number;
    friendly: number;
    caution: number;
    neutral: number;
    masterBonus: number;
    coreHourMatch: number;
    maxContribution: number;
  };
  panchang: {
    /** Maps muhurta 0–100 → delta via (score - 50) * scale */
    muhurtaScale: number;
    maxContribution: number;
  };
  gg33: {
    zodiacSynergy: Record<DailyNumerology['synergy'], number>;
    personalDayCompat: Record<CompatibilityLevel, number>;
    personalYearCoreMatch: number;
    maxContribution: number;
  };
  jyotish: {
    /** Maps jyotish score 0–100 → delta via (score - 50) * scale */
    scoreScale: number;
    challengingTransitPenalty: number;
    maxContribution: number;
  };
  crossSystem: {
    /** Apply master_numerology cross_system_rules total_bias directly */
    enabled: boolean;
  };
  convictionThresholds: {
    high: number;
    medium: number;
  };
}

export const DEFAULT_HYBRID_WEIGHTS: HybridScoringWeights = {
  personalHour: {
    best: 22,
    friendly: 10,
    caution: -18,
    neutral: 0,
    masterBonus: 8,
    coreHourMatch: 5,
    maxContribution: 35,
  },
  panchang: {
    muhurtaScale: 0.3,
    maxContribution: 25,
  },
  gg33: {
    zodiacSynergy: { friendly: 10, self: 8, neutral: 0, enemy: -12 },
    personalDayCompat: { ally: 8, friendly: 5, neutral: 0, tension: -4, enemy: -8 },
    personalYearCoreMatch: 6,
    maxContribution: 20,
  },
  jyotish: {
    scoreScale: 0.35,
    challengingTransitPenalty: -6,
    maxContribution: 20,
  },
  crossSystem: { enabled: true },
  convictionThresholds: { high: 72, medium: 52 },
};

// ─── User profile ────────────────────────────────────────────────────────────

export interface HybridUserProfile {
  name?: string;
  coreNumber: number;
  birthTime: string;
  btn?: number;
  transitionMinute?: number;
  calibrationOffset?: number;
  gg33: GG33Profile;
  jyotish: BirthChartProfile;
  timezoneOffsetMinutes?: number;
}

/** Kartikay defaults — tune gg33 birth date when known */
export const KARTIKAY_PROFILE: HybridUserProfile = {
  name: 'Kartikay Sharma',
  coreNumber: 4,
  birthTime: '20:20',
  gg33: { birthMonth: 5, birthDay: 15, birthYear: 1992 },
  jyotish: {
    birthDate: '1992-05-15',
    birthTime: '20:20',
    latitude: 28.6139,
    longitude: 77.209,
    timezoneOffsetMinutes: IST_OFFSET_MINUTES,
  },
  timezoneOffsetMinutes: IST_OFFSET_MINUTES,
};

// ─── Response schema ─────────────────────────────────────────────────────────

export type ConvictionLevel = 'High' | 'Medium' | 'Low';

export interface ScoringLineItem {
  system: 'personal_hour' | 'panchang' | 'gg33' | 'jyotish' | 'cross_system';
  label: string;
  delta: number;
  rationale: string;
}

export interface PersonalHourEnriched {
  personalHour: number;
  isMaster: boolean;
  quality: PersonalHourQuality;
  windowStart: string;
  windowEnd: string;
  hourCount: number;
  rawSum: number;
  isActive: boolean;
  /** Why this hour matters for the user's core number */
  coreContext: {
    coreNumber: number;
    resonance: 'amplified' | 'supportive' | 'neutral' | 'challenging' | 'identity_mirror';
    whyItMatters: string;
    bestActions: string[];
    cautionActions: string[];
  };
  recommendationsSeed: PersonalHourResult['recommendationsSeed'];
}

export interface PanchangEnriched {
  tithi: PanchangData['tithi'];
  nakshatra: PanchangData['nakshatra'];
  yoga: PanchangData['yoga'];
  karana: PanchangData['karana'];
  vara: string;
  muhurta: PanchangData['muhurta'];
  note: string;
}

export interface GG33Enriched {
  personalYear: number;
  personalMonth: number;
  personalDay: number;
  dailyNumber: number;
  personalYearPhase: { theme: string; keywords: string[]; best_actions: string[] };
  yearAnimal: string;
  dayAnimal: string;
  synergy: DailyNumerology['synergy'];
  themeNote: string;
  coreOverlay: {
    personalDayVsCore: CompatibilityLevel;
    flavor: string;
  };
}

export interface JyotishEnriched extends JyotishContext {
  personalHourInteraction: string;
}

export interface HighConvictionAction {
  domain: 'trading' | 'deals' | 'launches' | 'meetings';
  recommendation: string;
  gatedBy: string;
}

export interface PhGateNotice {
  suppressed: boolean;
  message: string | null;
  rawLevel: ConvictionLevel;
  allowedTiers: string[];
}

export interface HybridAdvisorResponse {
  meta: {
    version: string;
    generatedAt: string;
    targetDateTime: string;
    timezoneOffsetMinutes: number;
    weights: HybridScoringWeights;
    doctrineId?: string;
  };
  user: { name?: string; coreNumber: number; birthTime: string };
  conviction: {
    level: ConvictionLevel;
    score: number;
    summary: string;
  };
  phGate: PhGateNotice;
  personalHour: PersonalHourEnriched;
  panchang: PanchangEnriched;
  jyotish: JyotishEnriched;
  gg33: GG33Enriched;
  synthesis: {
    dos: string[];
    donts: string[];
    /** Only populated when PH is best or master — per user requirement */
    highConvictionActions: HighConvictionAction[] | null;
    scoringBreakdown: ScoringLineItem[];
    matchedCrossRules: string[];
  };
  patternNote: {
    status: 'placeholder';
    message: string;
    futureFields: string[];
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function capContribution(delta: number, max: number): number {
  return clamp(delta, -max, max);
}

function toIso(d: Date): string {
  return d.toISOString();
}

function buildCoreContext(
  ph: PersonalHourResult,
  coreNumber: number
): PersonalHourEnriched['coreContext'] {
  const profile = getNumberProfile(coreNumber);
  const compat = getNumberCompatibility(coreNumber, ph.personalHour);

  let resonance: PersonalHourEnriched['coreContext']['resonance'] = 'neutral';
  if (ph.personalHour === coreNumber) resonance = 'identity_mirror';
  else if (compat === 'ally') resonance = 'amplified';
  else if (compat === 'friendly') resonance = 'supportive';
  else if (compat === 'enemy' || compat === 'tension') resonance = 'challenging';

  const coreLabel = profile?.label ?? `Core ${coreNumber}`;
  const phLabel = getNumberProfile(ph.personalHour)?.label ?? `Hour ${ph.personalHour}`;

  let whyItMatters = `Personal Hour ${ph.personalHour} (${phLabel}) in a ${ph.quality} window. `;
  if (coreNumber === 4) {
    if (ph.quality === 'best' || ph.isMaster) {
      whyItMatters += 'Core 4 Builder: rare high-conviction slot for contracts, systems, and material moves.';
    } else if (ph.quality === 'friendly') {
      whyItMatters += 'Core 4 Builder: supportive hour for collaboration and steady structural progress — not peak deal-closing energy.';
    } else if (ph.quality === 'caution') {
      whyItMatters += 'Core 4 Builder: protect foundation — avoid impulsive pivots or speculative risk.';
    } else {
      whyItMatters += 'Core 4 Builder: neutral mirror hour — good for routine SOP work and documentation.';
    }
  } else {
    whyItMatters += `${coreLabel} native: ${resonance} resonance with current hour.`;
  }

  return {
    coreNumber,
    resonance,
    whyItMatters,
    bestActions: getNumberProfile(ph.personalHour)?.best_actions ?? profile?.best_actions ?? [],
    cautionActions: getNumberProfile(ph.personalHour)?.caution_actions ?? profile?.caution_actions ?? [],
  };
}

function scorePersonalHour(
  ph: PersonalHourResult,
  coreNumber: number,
  w: HybridScoringWeights['personalHour']
): { delta: number; items: ScoringLineItem[] } {
  const items: ScoringLineItem[] = [];
  let delta = w[ph.quality];
  items.push({
    system: 'personal_hour',
    label: `PH ${ph.personalHour} quality=${ph.quality}`,
    delta,
    rationale: 'Personal Hour is the primary intraday timing signal (arthouse33).',
  });

  if (ph.isMaster) {
    items.push({
      system: 'personal_hour',
      label: 'Master number preserved',
      delta: w.masterBonus,
      rationale: 'Raw sum hit 11/22/33 — high-conviction master channel.',
    });
    delta += w.masterBonus;
  }

  if (ph.personalHour === coreNumber) {
    items.push({
      system: 'personal_hour',
      label: 'PH equals core',
      delta: w.coreHourMatch,
      rationale: 'Identity-mirror hour — self-alignment boost, not automatically best tier.',
    });
    delta += w.coreHourMatch;
  }

  const doctrineExtra = doctrinePersonalHourExtras(ph, w);
  if (doctrineExtra.label && doctrineExtra.delta !== 0) {
    items.push({
      system: 'personal_hour',
      label: doctrineExtra.label,
      delta: doctrineExtra.delta,
      rationale: 'Kartikay doctrine: Core-4-friendly / caution PH number bias.',
    });
    delta += doctrineExtra.delta;
  }

  return { delta: capContribution(delta, w.maxContribution), items };
}

function scorePanchang(
  panchang: PanchangData,
  w: HybridScoringWeights['panchang']
): { delta: number; items: ScoringLineItem[] } {
  const raw = (panchang.muhurta.score - 50) * w.muhurtaScale;
  const delta = capContribution(Math.round(raw), w.maxContribution);
  return {
    delta,
    items: [{
      system: 'panchang',
      label: `Muhurta ${panchang.muhurta.score} (${panchang.muhurta.label})`,
      delta,
      rationale: 'Panchang muhurta quality — traditional auspiciousness for actionable timing.',
    }],
  };
}

function scoreGG33(
  gg33: DailyNumerology,
  coreNumber: number,
  w: HybridScoringWeights['gg33']
): { delta: number; items: ScoringLineItem[] } {
  const items: ScoringLineItem[] = [];
  let delta = w.zodiacSynergy[gg33.synergy];
  items.push({
    system: 'gg33',
    label: `Zodiac ${gg33.yearAnimal}×${gg33.dayAnimal}=${gg33.synergy}`,
    delta,
    rationale: 'Vietnamese/Chinese zodiac synergy for the calendar day.',
  });

  const pdCompat = getNumberCompatibility(coreNumber, gg33.personalDay);
  const pdDelta = w.personalDayCompat[pdCompat];
  items.push({
    system: 'gg33',
    label: `Personal Day ${gg33.personalDay} vs Core ${coreNumber}=${pdCompat}`,
    delta: pdDelta,
    rationale: 'Personal Day resonance with life-path core number.',
  });
  delta += pdDelta;

  if (gg33.personalYear === coreNumber) {
    items.push({
      system: 'gg33',
      label: 'Personal Year equals core',
      delta: w.personalYearCoreMatch,
      rationale: 'Macro-year theme mirrors life path — amplified annual resonance.',
    });
    delta += w.personalYearCoreMatch;
  }

  return { delta: capContribution(delta, w.maxContribution), items };
}

function scoreJyotish(
  jyotish: JyotishContext,
  w: HybridScoringWeights['jyotish']
): { delta: number; items: ScoringLineItem[] } {
  const items: ScoringLineItem[] = [];
  let delta = Math.round((jyotish.score - 50) * w.scoreScale);
  items.push({
    system: 'jyotish',
    label: `Jyotish aggregate ${jyotish.score}`,
    delta,
    rationale: 'Dasha + transit backdrop from jyotish-api.',
  });

  const challenging = jyotish.transits.filter((t) => t.nature === 'challenging').length;
  if (challenging > 0) {
    const pen = w.challengingTransitPenalty * challenging;
    items.push({
      system: 'jyotish',
      label: `${challenging} challenging transit(s)`,
      delta: pen,
      rationale: 'Hard aspects caution against forcing outcomes this hour.',
    });
    delta += pen;
  }

  return { delta: capContribution(delta, w.maxContribution), items };
}

function convictionFromScore(score: number, thresholds: HybridScoringWeights['convictionThresholds']): ConvictionLevel {
  if (score >= thresholds.high) return 'High';
  if (score >= thresholds.medium) return 'Medium';
  return 'Low';
}

function buildHighConvictionActions(
  ph: PersonalHourResult,
  _conviction: ConvictionLevel
): HighConvictionAction[] | null {
  const isBestOrMaster = ph.quality === 'best' || ph.isMaster;
  if (!isBestOrMaster) return null;

  const gate = `PH ${ph.personalHour} (${ph.quality}${ph.isMaster ? ', master' : ''})`;

  return [
    { domain: 'trading', recommendation: 'Size up only on planned setups; avoid revenge trades.', gatedBy: gate },
    { domain: 'deals', recommendation: 'Sign, negotiate closes, or send term sheets.', gatedBy: gate },
    { domain: 'launches', recommendation: 'Ship v1, publish, or open cart — capitalize on visibility.', gatedBy: gate },
    { domain: 'meetings', recommendation: 'Schedule high-stakes conversations and authority asks.', gatedBy: gate },
  ];
}

export interface HybridAdvisorInput {
  targetDateTime: Date;
  user?: HybridUserProfile;
  weights?: HybridScoringWeights;
  doctrine?: KartikayDoctrine | null;
  jyotishOptions?: JyotishAdapterOptions;
}

function buildPhGateNotice(gateResult: PhGateResult, doctrine?: KartikayDoctrine | null): PhGateNotice {
  return {
    suppressed: gateResult.suppressed,
    message: gateResult.message,
    rawLevel: gateResult.rawLevel,
    allowedTiers: doctrine?.ph_gate.high_conviction_only_on ?? ['best', 'master'],
  };
}

/**
 * Main entry: hybrid recommendation for any datetime + user.
 */
export async function getHybridTimingAdvice(
  input: HybridAdvisorInput
): Promise<HybridAdvisorResponse> {
  const user = input.user ?? KARTIKAY_PROFILE;
  const doctrine = input.doctrine ?? null;
  const weights =
    input.weights ??
    (doctrine ? resolveDoctrineWeights(DEFAULT_HYBRID_WEIGHTS, doctrine) : DEFAULT_HYBRID_WEIGHTS);
  const tz = user.timezoneOffsetMinutes ?? IST_OFFSET_MINUTES;
  const dt = input.targetDateTime;

  const phProfile = {
    birthTime: user.birthTime,
    btn: user.btn ?? DEFAULT_PERSONAL_HOUR_PROFILE.btn,
    transitionMinute: user.transitionMinute ?? DEFAULT_PERSONAL_HOUR_PROFILE.transitionMinute,
    coreNumber: user.coreNumber,
    calibrationOffset: user.calibrationOffset ?? 0,
  };

  const ph = calculatePersonalHour({
    profile: phProfile,
    targetDateTime: dt,
    timezoneOffsetMinutes: tz,
  });

  const panchang = getPanchang(dt);
  const gg33Raw = calculateDailyNumerology(dt, user.gg33);
  const jyotish = await getJyotishContext(dt, user.jyotish, input.jyotishOptions);

  const coreContext = buildCoreContext(ph, user.coreNumber);
  const pyPhase = getPersonalYearPhase(gg33Raw.personalYear);
  const pdCompat = getNumberCompatibility(user.coreNumber, gg33Raw.personalDay);

  const gg33: GG33Enriched = {
    ...gg33Raw,
    personalYearPhase: {
      theme: pyPhase?.theme ?? `Personal Year ${gg33Raw.personalYear}`,
      keywords: pyPhase?.keywords ?? [],
      best_actions: pyPhase?.best_actions ?? [],
    },
    coreOverlay: {
      personalDayVsCore: pdCompat,
      flavor: getNumberProfile(gg33Raw.personalDay)?.gg33_flavor
        ?? `Personal Day ${gg33Raw.personalDay} ${pdCompat} with Core ${user.coreNumber}`,
    },
  };

  const jyotishEnriched: JyotishEnriched = {
    ...jyotish,
    personalHourInteraction: jyotish.transits
      .map((t) => t.personalHourInteraction)
      .filter(Boolean)
      .join(' ') || `Dasha ${jyotish.dasha.maha}/${jyotish.dasha.antar} colors PH ${ph.personalHour} execution style.`,
  };

  // ─── Scoring ─────────────────────────────────────────────────────────────
  const breakdown: ScoringLineItem[] = [];
  let score = 50;

  const phScore = scorePersonalHour(ph, user.coreNumber, weights.personalHour);
  breakdown.push(...phScore.items);
  score += phScore.delta;

  const panScore = scorePanchang(panchang, weights.panchang);
  breakdown.push(...panScore.items);
  score += panScore.delta;

  const ggScore = scoreGG33(gg33Raw, user.coreNumber, weights.gg33);
  breakdown.push(...ggScore.items);
  score += ggScore.delta;

  const jyScore = scoreJyotish(jyotish, weights.jyotish);
  breakdown.push(...jyScore.items);
  score += jyScore.delta;

  let matchedCrossRules: string[] = [];
  if (weights.crossSystem.enabled) {
    const tithiPhase: TithiPhase = panchang.tithi.phase;
    const cross = evaluateCrossSystem({
      personal_hour: ph.personalHour,
      personal_hour_quality: ph.quality,
      personal_day: gg33Raw.personalDay,
      personal_year: gg33Raw.personalYear,
      user_core: user.coreNumber,
      zodiac_synergy: gg33Raw.synergy,
      tithi_phase: tithiPhase === 'unknown' ? 'unknown' : tithiPhase,
      yoga_strength: panchang.yoga.strength ?? 'unknown',
      number_compatibility: pdCompat,
    });
    if (cross.total_bias !== 0) {
      breakdown.push({
        system: 'cross_system',
        label: `Cross-rules (${cross.matched_rules.length} matched)`,
        delta: cross.total_bias,
        rationale: cross.matched_rules.map((m) => m.rule.id).join(', ') || 'none',
      });
      score += cross.total_bias;
      matchedCrossRules = cross.matched_rules.map((m) => m.rule.id);
    }
  }

  score = clamp(Math.round(score), 10, 95);
  const rawConvictionLevel = convictionFromScore(score, weights.convictionThresholds);
  const gateResult = doctrine
    ? applyPhGate(ph, rawConvictionLevel, doctrine.ph_gate)
    : { level: rawConvictionLevel, suppressed: false, message: null, rawLevel: rawConvictionLevel };
  const convictionLevel = gateResult.level;

  const personalHourEnriched: PersonalHourEnriched = {
    personalHour: ph.personalHour,
    isMaster: ph.isMaster,
    quality: ph.quality,
    windowStart: toIso(ph.windowStart),
    windowEnd: toIso(ph.windowEnd),
    hourCount: ph.hourCount,
    rawSum: ph.rawSum,
    isActive: ph.isActive,
    coreContext,
    recommendationsSeed: ph.recommendationsSeed,
  };

  const { dos, donts } = buildDosDontsFromParts(ph, coreContext, panchang, gg33, jyotishEnriched, convictionLevel);

  const summaryParts = [
    `Conviction ${convictionLevel} (${score}/100).`,
    `PH ${ph.personalHour} (${ph.quality})`,
    `Muhurta ${panchang.muhurta.score}`,
    `PY${gg33Raw.personalYear}/PD${gg33Raw.personalDay}`,
    `${gg33Raw.synergy} zodiac`,
  ];
  if (gateResult.suppressed) {
    summaryParts.push(`PH gate capped ${gateResult.rawLevel}→Medium`);
  }
  const summary = summaryParts.join(' · ');

  return {
    meta: {
      version: '1.0.0',
      generatedAt: new Date().toISOString(),
      targetDateTime: toIso(dt),
      timezoneOffsetMinutes: tz,
      weights,
      doctrineId: doctrine?.meta.id,
    },
    user: { name: user.name, coreNumber: user.coreNumber, birthTime: user.birthTime },
    conviction: { level: convictionLevel, score, summary },
    phGate: buildPhGateNotice(gateResult, doctrine),
    personalHour: personalHourEnriched,
    panchang: {
      tithi: panchang.tithi,
      nakshatra: panchang.nakshatra,
      yoga: panchang.yoga,
      karana: panchang.karana,
      vara: panchang.vara,
      muhurta: panchang.muhurta,
      note: panchang.note,
    },
    jyotish: jyotishEnriched,
    gg33,
    synthesis: {
      dos,
      donts,
      highConvictionActions: buildHighConvictionActions(ph, convictionLevel),
      scoringBreakdown: breakdown,
      matchedCrossRules,
    },
    patternNote: {
      status: 'placeholder',
      message: 'Personalized pattern learning not yet active.',
      futureFields: ['historical_outcome_correlation', 'user_action_log_weights', 'best_window_hit_rate'],
    },
  };
}

function buildDosDontsFromParts(
  ph: PersonalHourResult,
  coreContext: PersonalHourEnriched['coreContext'],
  panchang: PanchangData,
  gg33: GG33Enriched,
  jyotish: JyotishEnriched,
  conviction: ConvictionLevel
): { dos: string[]; donts: string[] } {
  const dos = new Set<string>();
  const donts = new Set<string>();

  ph.recommendationsSeed.focus.forEach((f) => dos.add(f));
  ph.recommendationsSeed.avoid.forEach((a) => donts.add(a));
  coreContext.bestActions.slice(0, 2).forEach((a) => dos.add(a));
  coreContext.cautionActions.slice(0, 2).forEach((a) => donts.add(a));

  if (panchang.muhurta.label === 'excellent' || panchang.muhurta.label === 'good') {
    dos.add('Align important steps with current tithi/nakshatra support');
  }
  if (panchang.muhurta.label === 'caution') {
    donts.add('Avoid muhurta-heavy commitments (marriage-level stakes)');
  }

  gg33.personalYearPhase.best_actions.slice(0, 2).forEach((a) => dos.add(a));
  if (gg33.synergy === 'friendly' || gg33.synergy === 'self') dos.add(gg33.themeNote);
  if (gg33.synergy === 'enemy') donts.add(gg33.themeNote);

  if (jyotish.dasha.nature === 'supportive') dos.add(jyotish.dasha.note);
  jyotish.transits.filter((t) => t.nature === 'challenging').forEach((t) => donts.add(t.note));

  if (conviction === 'Low') {
    donts.add('Defer high-stakes commitments if possible');
    dos.add('Routine execution and planning');
  }

  return { dos: [...dos].slice(0, 8), donts: [...donts].slice(0, 8) };
}

/** Sync wrapper for tests / demo without async jyotish */
export function getHybridTimingAdviceSync(
  input: Omit<HybridAdvisorInput, 'jyotishOptions'> & { jyotishOptions?: JyotishAdapterOptions }
): Promise<HybridAdvisorResponse> {
  return getHybridTimingAdvice({
    ...input,
    jyotishOptions: { ...input.jyotishOptions, useStub: true },
  });
}