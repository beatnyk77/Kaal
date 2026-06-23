/**
 * Normalized combo fingerprint for pattern matching across logs.
 */

import type { TimingSnapshot } from './types';

export function buildComboKey(parts: {
  personalHour: number;
  muhurtaScore: number;
  personalDay: number;
  synergy: string;
  domain?: string;
}): string {
  const muhurtaBand = Math.floor(parts.muhurtaScore / 10) * 10;
  const base = `ph${parts.personalHour}|muh${muhurtaBand}|pd${parts.personalDay}|zod_${parts.synergy}`;
  return parts.domain ? `${base}|dom_${parts.domain}` : base;
}

export function comboKeyFromSnapshot(snapshot: TimingSnapshot, domain?: string): string {
  return buildComboKey({
    personalHour: snapshot.personal_hour.number,
    muhurtaScore: snapshot.panchang.muhurta_score,
    personalDay: snapshot.gg33.personal_day,
    synergy: snapshot.gg33.synergy,
    domain,
  });
}