/**
 * FusionEngine (early version)
 *
 * Combines:
 * - PersonalHour (your core timing)
 * - Panchang signals
 * - GG33 / Viet numerology
 *
 * Produces a simple unified recommendation + score.
 *
 * This is deliberately naive/ugly first. Real weights and pattern recognition come in Phase 4-5.
 */

import type { PersonalHour } from './personalHour';
import type { PanchangData } from './panchangAdapter';
import type { DailyNumerology } from './gg33Viet';

export interface TimingRecommendation {
  score: number; // 0-100
  verdict: 'HIGH CONVICTION' | 'FAVORABLE' | 'STEADY' | 'CAUTION' | 'AVOID';
  reasons: string[];
  suggestedActions: string[];
  combinedNote: string;
}

export function fuseSignals(
  ph: PersonalHour,
  panchang: PanchangData,
  gg33: DailyNumerology
): TimingRecommendation {
  let score = 50;

  // Personal Hour weight (your most trusted signal)
  if (ph.quality === 'best') score += 25;
  else if (ph.quality === 'friendly') score += 12;
  else if (ph.quality === 'caution') score -= 15;

  // Panchang
  if (panchang.isAuspicious) score += 12;
  else score -= 5;

  // GG33 / Viet
  if (gg33.synergy === 'friendly') score += 10;
  else if (gg33.synergy === 'enemy') score -= 12;
  else if (gg33.synergy === 'self') score += 8;

  // Masters in PH get extra love
  if ([11, 22, 33].includes(ph.personalHour)) score += 8;

  score = Math.max(15, Math.min(95, Math.round(score)));

  let verdict: TimingRecommendation['verdict'];
  if (score >= 80) verdict = 'HIGH CONVICTION';
  else if (score >= 65) verdict = 'FAVORABLE';
  else if (score >= 50) verdict = 'STEADY';
  else if (score >= 35) verdict = 'CAUTION';
  else verdict = 'AVOID';

  const reasons: string[] = [];
  reasons.push(`Personal Hour ${ph.personalHour} is ${ph.quality}`);
  reasons.push(`${panchang.tithi.name} in ${panchang.nakshatra.name} — ${panchang.note}`);
  reasons.push(`Personal Day ${gg33.personalDay} on ${gg33.dayAnimal} day (${gg33.synergy})`);

  const suggestedActions: string[] = [];
  if (verdict === 'HIGH CONVICTION' || verdict === 'FAVORABLE') {
    suggestedActions.push('High-leverage actions', 'Important conversations / launches', 'Creative deep work');
  } else if (verdict === 'STEADY') {
    suggestedActions.push('Routine execution', 'Planning & admin', 'Follow-ups');
  } else {
    suggestedActions.push('Maintenance only', 'Avoid big commitments if possible', 'Recharge & review');
  }

  const combinedNote = `${verdict} window. ${ph.quality.toUpperCase()} personal hour + ${gg33.synergy} animal synergy.`;

  return {
    score,
    verdict,
    reasons,
    suggestedActions,
    combinedNote,
  };
}
