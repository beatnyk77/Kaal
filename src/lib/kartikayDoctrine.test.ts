import { describe, it, expect } from 'vitest';
import { createKartikayProfile } from './intelligence/profileFactory';
import {
  applyPhGate,
  KARTIKAY_DOCTRINE,
  resolveDoctrineWeights,
  seedLearnedHourWeights,
} from './kartikayDoctrine';
import { DEFAULT_HYBRID_WEIGHTS } from './hybridTimingAdvisor';

describe('kartikay doctrine', () => {
  it('loads conservative thresholds and PH gate', () => {
    const weights = resolveDoctrineWeights(DEFAULT_HYBRID_WEIGHTS, KARTIKAY_DOCTRINE);
    expect(weights.convictionThresholds.high).toBe(75);
    expect(weights.convictionThresholds.medium).toBe(55);
    expect(weights.personalHour.best).toBe(28);
    expect(weights.personalHour.caution).toBe(-24);
    expect(KARTIKAY_DOCTRINE.ph_gate.high_conviction_only_on).toEqual(['best', 'master']);
  });

  it('seeds cold-start hour weights on Kartikay profile', () => {
    const profile = createKartikayProfile();
    expect(profile.preferences.conviction_sensitivity).toBe('conservative');
    expect(profile.personal_hours.learned_hour_weights?.['8']).toBe(0.25);
    expect(profile.personal_hours.learned_hour_weights?.['4']).toBe(0.1);
    expect(seedLearnedHourWeights()['22']).toBe(0.2);
  });

  it('caps High conviction outside Best/Master PH', () => {
    const blocked = applyPhGate(
      { personalHour: 3, quality: 'caution', isMaster: false },
      'High',
      KARTIKAY_DOCTRINE.ph_gate
    );
    expect(blocked.level).toBe('Medium');
    expect(blocked.suppressed).toBe(true);

    const allowed = applyPhGate(
      { personalHour: 8, quality: 'best', isMaster: false },
      'High',
      KARTIKAY_DOCTRINE.ph_gate
    );
    expect(allowed.level).toBe('High');
    expect(allowed.suppressed).toBe(false);
  });
});