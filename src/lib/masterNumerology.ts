/**
 * Master Numerology Knowledge Base — query layer
 *
 * Loads data/master_numerology.json and exposes typed lookups
 * for the fusion engine, planners, and future PatternRecognizer.
 */

import kb from '../data/master_numerology.json';

// ─── Types (mirror schema; partial for v0.1 populated entries) ───────────────

export type CompatibilityLevel = 'ally' | 'friendly' | 'neutral' | 'tension' | 'enemy';
export type PHQuality = 'best' | 'friendly' | 'caution' | 'neutral';
export type ZodiacSynergy = 'friendly' | 'neutral' | 'enemy' | 'self';
export type RecommendationStrength = 'very_high' | 'high' | 'moderate' | 'low' | 'avoid';

export interface GrahaMapping {
  primary: string;
  sanskrit: string;
  western: string;
  element?: string;
  weekday_lord?: boolean;
  notes?: string;
}

export interface NumberProfile {
  id: number;
  label: string;
  type: 'root' | 'master';
  archetype?: string;
  core_themes: string[];
  shadow_themes?: string[];
  best_actions: string[];
  caution_actions: string[];
  friendly_numbers: number[];
  enemy_numbers: number[];
  neutral_numbers: number[];
  graha: GrahaMapping;
  personal_year_affinity?: {
    amplified?: number[];
    supportive?: number[];
    challenging?: number[];
  };
  action_tags?: string[];
  gg33_flavor?: string;
  calibration_status?: string;
}

export interface ZodiacAnimal {
  id: string;
  name: string;
  vietnamese_name: string;
  chinese_equivalent?: string;
  index: number;
  primary_number?: number;
  core_themes: string[];
  best_actions: string[];
  caution_actions: string[];
  friendly_animals: string[];
  enemy_animals: string[];
  neutral_animals: string[];
  number_synergy?: {
    amplified_numbers?: number[];
    friendly_numbers?: number[];
    caution_numbers?: number[];
  };
  synergy_rules: {
    triad: string[];
    enemy: string;
    self: string;
    hidden_friend?: string[];
  };
  vietnam_note?: string;
}

export interface CrossSystemRule {
  id: string;
  name: string;
  priority: number;
  description?: string;
  conditions: Array<{
    signal: string;
    operator: string;
    value: unknown;
  }>;
  outcome: {
    recommendation_strength: RecommendationStrength;
    verdict_bias: number;
    suggested_actions?: string[];
    caution_actions?: string[];
    domains?: string[];
    explanation_template?: string;
  };
  tags?: string[];
}

export interface FusionContext {
  personal_hour: number;
  personal_hour_quality: PHQuality;
  personal_day: number;
  personal_year: number;
  daily_number?: number;
  user_core: number;
  zodiac_synergy: ZodiacSynergy;
  tithi_phase?: 'shukla' | 'krishna' | 'unknown';
  yoga_strength?: 'strong' | 'moderate' | 'weak' | 'unknown';
  number_compatibility?: CompatibilityLevel;
}

export interface MatchedRule {
  rule: CrossSystemRule;
  outcome: CrossSystemRule['outcome'];
}

export interface SynthesisResult {
  matched_rules: MatchedRule[];
  top_strength: RecommendationStrength;
  total_bias: number;
  suggested_actions: string[];
  caution_actions: string[];
  explanations: string[];
}

type MasterKB = typeof kb;

const MASTER: MasterKB = kb;

// ─── Core accessors ───────────────────────────────────────────────────────────

export function getKBMeta() {
  return MASTER.meta;
}

export function getCalculationMethod(id: keyof MasterKB['calculation_methods'] | string) {
  if (id in MASTER.calculation_methods) {
    return MASTER.calculation_methods[id as keyof MasterKB['calculation_methods']];
  }
  const daily = MASTER.calculation_methods.daily_numbers;
  if (id in daily) return daily[id as keyof typeof daily];
  return undefined;
}

export function getPersonalHourMethod() {
  return MASTER.calculation_methods.personal_hour;
}

export function getNumberProfile(n: number): NumberProfile | undefined {
  const key = String(n) as keyof typeof MASTER.number_profiles;
  return MASTER.number_profiles[key] as NumberProfile | undefined;
}

export function getAllNumberProfiles(): NumberProfile[] {
  return Object.values(MASTER.number_profiles) as NumberProfile[];
}

export function getPHQuality(ph: number): PHQuality {
  const tiers = MASTER.compatibility.personal_hour_quality.tiers;
  if (tiers.best.includes(ph)) return 'best';
  if (tiers.friendly.includes(ph)) return 'friendly';
  if (tiers.caution.includes(ph)) return 'caution';
  return 'neutral';
}

export function getNumberCompatibility(a: number, b: number): CompatibilityLevel {
  const entry = MASTER.compatibility.number_matrix.entries.find(
    (e) => (e.a === a && e.b === b) || (e.a === b && e.b === a)
  );
  if (entry) return entry.level as CompatibilityLevel;

  const profileA = getNumberProfile(a);
  if (!profileA) return 'neutral';
  if (profileA.friendly_numbers.includes(b)) return 'friendly';
  if (profileA.enemy_numbers.includes(b)) return 'enemy';
  if (a === b) return 'ally';
  return 'neutral';
}

export function getZodiacAnimal(id: string): ZodiacAnimal | undefined {
  return MASTER.zodiac.animals.find((a) => a.id === id) as ZodiacAnimal | undefined;
}

export function getZodiacSynergy(
  birthAnimalId: string,
  dayAnimalId: string
): ZodiacSynergy {
  if (birthAnimalId === dayAnimalId) return 'self';

  const birth = getZodiacAnimal(birthAnimalId);
  const day = getZodiacAnimal(dayAnimalId);

  if (birth && birth.enemy_animals.includes(dayAnimalId)) return 'enemy';
  if (day && day.enemy_animals.includes(birthAnimalId)) return 'enemy';

  const enemies = MASTER.zodiac.enemies as Record<string, string>;
  if (enemies[birthAnimalId] === dayAnimalId) return 'enemy';

  if (birth?.friendly_animals.includes(dayAnimalId)) return 'friendly';
  if (birth?.synergy_rules.triad.includes(dayAnimalId)) return 'friendly';

  return 'neutral';
}

export function getPersonalYearPhase(py: number) {
  const key = String(py) as keyof typeof MASTER.personal_year.phases;
  return MASTER.personal_year.phases[key];
}

export function getCore4FourYearGuidance() {
  return MASTER.personal_year.four_year_energy.core_4_guidance;
}

export function getCrossSystemRules(): CrossSystemRule[] {
  return MASTER.cross_system_rules as CrossSystemRule[];
}

// ─── Rule matcher (simple v1) ─────────────────────────────────────────────────

function evalCondition(
  cond: CrossSystemRule['conditions'][number],
  ctx: FusionContext
): boolean {
  const val = (() => {
    switch (cond.signal) {
      case 'personal_hour': return ctx.personal_hour;
      case 'personal_hour_quality': return ctx.personal_hour_quality;
      case 'personal_day': return ctx.personal_day;
      case 'personal_year': return ctx.personal_year;
      case 'zodiac_synergy': return ctx.zodiac_synergy;
      case 'tithi_phase': return ctx.tithi_phase ?? 'unknown';
      case 'yoga_strength': return ctx.yoga_strength ?? 'unknown';
      case 'number_compatibility':
        return ctx.number_compatibility ?? getNumberCompatibility(ctx.user_core, ctx.personal_day);
      case 'core_match': return ctx.user_core;
      default: return undefined;
    }
  })();

  const target = cond.value;

  switch (cond.operator) {
    case 'eq': return val === target;
    case 'neq': return val !== target;
    case 'in': return Array.isArray(target) && target.includes(val);
    case 'not_in': return Array.isArray(target) && !target.includes(val);
    case 'gte': {
      const order = ['weak', 'moderate', 'strong', 'unknown'];
      if (typeof val === 'string' && typeof target === 'string') {
        return order.indexOf(val) >= order.indexOf(target);
      }
      return typeof val === 'number' && typeof target === 'number' && val >= target;
    }
    default: return false;
  }
}

export function evaluateCrossSystem(ctx: FusionContext): SynthesisResult {
  const matched: MatchedRule[] = [];

  for (const rule of getCrossSystemRules()) {
    const allMatch = rule.conditions.every((c) => evalCondition(c, ctx));
    if (allMatch) matched.push({ rule, outcome: rule.outcome });
  }

  matched.sort((a, b) => b.rule.priority - a.rule.priority);

  const strengthOrder: RecommendationStrength[] = ['avoid', 'low', 'moderate', 'high', 'very_high'];
  let top: RecommendationStrength = 'moderate';
  let totalBias = 0;
  const actions = new Set<string>();
  const cautions = new Set<string>();
  const explanations: string[] = [];

  for (const m of matched) {
    totalBias += m.outcome.verdict_bias;
    m.outcome.suggested_actions?.forEach((a) => actions.add(a));
    m.outcome.caution_actions?.forEach((a) => cautions.add(a));
    if (m.outcome.explanation_template) {
      explanations.push(`[${m.rule.id}] ${m.outcome.explanation_template}`);
    }
    if (strengthOrder.indexOf(m.outcome.recommendation_strength) > strengthOrder.indexOf(top)) {
      top = m.outcome.recommendation_strength;
    }
  }

  return {
    matched_rules: matched,
    top_strength: matched.length ? top : 'moderate',
    total_bias: totalBias,
    suggested_actions: [...actions],
    caution_actions: [...cautions],
    explanations,
  };
}

// ─── Index queries ────────────────────────────────────────────────────────────

export function queryByActionTag(tag: string): string[] {
  const idx = MASTER.query_indices.by_action_tag as Record<string, string[]>;
  return idx[tag] ?? [];
}

export function queryByNumber(n: number): string | undefined {
  const idx = MASTER.query_indices.by_number as Record<string, string>;
  return idx[String(n)];
}

export function queryByGraha(graha: string): string | undefined {
  const idx = MASTER.query_indices.by_graha as Record<string, string>;
  return idx[graha.toLowerCase()];
}