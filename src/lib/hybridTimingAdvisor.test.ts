import { describe, it, expect } from 'vitest';
import {
  getHybridTimingAdviceSync,
  KARTIKAY_PROFILE,
  DEFAULT_HYBRID_WEIGHTS,
} from './hybridTimingAdvisor';
import { KARTIKAY_DOCTRINE, resolveDoctrineWeights } from './kartikayDoctrine';

const KARTIKAY_WEIGHTS = resolveDoctrineWeights(DEFAULT_HYBRID_WEIGHTS, KARTIKAY_DOCTRINE);

describe('Hybrid Timing Advisor', () => {
  it('returns full schema for Kartikay 2026-06-23 15:28 IST', async () => {
    const dt = new Date('2026-06-23T15:28:00+05:30');
    const res = await getHybridTimingAdviceSync({
      targetDateTime: dt,
      user: KARTIKAY_PROFILE,
    });

    expect(res.meta.version).toBe('1.0.0');
    expect(res.user.coreNumber).toBe(4);
    expect(res.personalHour.personalHour).toBe(2);
    expect(res.personalHour.quality).toBe('friendly');
    expect(res.personalHour.coreContext.coreNumber).toBe(4);
    expect(res.personalHour.coreContext.whyItMatters).toContain('Core 4');

    expect(res.panchang.muhurta.score).toBeGreaterThan(0);
    expect(res.jyotish.source).toBe('stub');
    expect(res.gg33.personalYear).toBeGreaterThan(0);

    expect(res.conviction.level).toMatch(/High|Medium|Low/);
    expect(res.synthesis.scoringBreakdown.length).toBeGreaterThan(3);
    expect(res.synthesis.highConvictionActions).toBeNull(); // PH 2 friendly — not best/master
    expect(res.patternNote.status).toBe('placeholder');
  });

  it('surfaces high-conviction actions only in best/master PH', async () => {
    const dt = new Date('2026-06-24T06:25:00+05:30'); // PH 11 master
    const res = await getHybridTimingAdviceSync({
      targetDateTime: dt,
      user: KARTIKAY_PROFILE,
    });

    expect(res.personalHour.personalHour).toBe(11);
    expect(res.personalHour.isMaster).toBe(true);
    expect(res.synthesis.highConvictionActions).not.toBeNull();
    expect(res.synthesis.highConvictionActions!.length).toBe(4);
    expect(res.synthesis.highConvictionActions!.map((a) => a.domain)).toContain('deals');
  });

  it('PH 8 + deal doctrine → High conviction allowed', async () => {
    const dt = new Date('2026-06-24T12:25:00+05:30');
    const res = await getHybridTimingAdviceSync({
      targetDateTime: dt,
      user: KARTIKAY_PROFILE,
      weights: KARTIKAY_WEIGHTS,
      doctrine: KARTIKAY_DOCTRINE,
    });

    expect(res.personalHour.personalHour).toBe(8);
    expect(res.personalHour.quality).toBe('best');
    expect(res.conviction.score).toBeGreaterThanOrEqual(KARTIKAY_WEIGHTS.convictionThresholds.high);
    expect(res.conviction.level).toBe('High');
    expect(res.phGate.suppressed).toBe(false);
    expect(res.synthesis.highConvictionActions).not.toBeNull();
    console.log('[verify] PH 8 + deal doctrine → High allowed:', res.conviction.level, res.conviction.score);
  });

  it('PH 3 + deal doctrine → High conviction blocked (Medium max)', async () => {
    const dt = new Date('2026-06-23T23:19:59+05:30');
    const inflated = {
      ...KARTIKAY_WEIGHTS,
      personalHour: { ...KARTIKAY_WEIGHTS.personalHour, caution: 35, caution_extra_penalty: 0 },
      panchang: { ...KARTIKAY_WEIGHTS.panchang, muhurtaScale: 0.8 },
      gg33: {
        ...KARTIKAY_WEIGHTS.gg33,
        zodiacSynergy: { friendly: 20, self: 18, neutral: 0, enemy: 0 },
        personalDayCompat: { ally: 15, friendly: 10, neutral: 0, tension: 0, enemy: 0 },
      },
      jyotish: { ...KARTIKAY_WEIGHTS.jyotish, scoreScale: 0.9 },
    };

    const res = await getHybridTimingAdviceSync({
      targetDateTime: dt,
      user: KARTIKAY_PROFILE,
      weights: inflated,
      doctrine: KARTIKAY_DOCTRINE,
    });

    expect(res.personalHour.personalHour).toBe(3);
    expect(res.personalHour.quality).toBe('caution');
    expect(res.phGate.rawLevel).toBe('High');
    expect(res.conviction.level).toBe('Medium');
    expect(res.phGate.suppressed).toBe(true);
    expect(res.phGate.message).toContain('PH 3');
    console.log('[verify] PH 3 + deal doctrine → High blocked:', res.phGate.rawLevel, '→', res.conviction.level);
  });

  it('weights are tunable', async () => {
    const dt = new Date('2026-06-23T15:28:00+05:30');
    const heavyPH = {
      ...DEFAULT_HYBRID_WEIGHTS,
      personalHour: { ...DEFAULT_HYBRID_WEIGHTS.personalHour, friendly: 30 },
    };
    const res = await getHybridTimingAdviceSync({
      targetDateTime: dt,
      user: KARTIKAY_PROFILE,
      weights: heavyPH,
    });
    expect(res.meta.weights.personalHour.friendly).toBe(30);
    const phLine = res.synthesis.scoringBreakdown.find((l) => l.system === 'personal_hour');
    expect(phLine?.delta).toBeGreaterThan(0);
  });
});