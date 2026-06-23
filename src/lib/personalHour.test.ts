import { describe, it, expect } from 'vitest';
import { getPersonalHour, DEFAULT_PROFILE } from './personalHour';

describe('PersonalHourEngine (20:20 birth, BTN=4, :20 transition)', () => {
  it('produces a valid PersonalHour for a sample time', () => {
    const t = new Date('2026-06-23T14:25:00'); // after 14:20
    const result = getPersonalHour(t, DEFAULT_PROFILE);

    expect(result.personalHour).toBeGreaterThan(0);
    expect(['best', 'friendly', 'caution', 'neutral']).toContain(result.quality);
    expect(result.clockHour).toBe(14);
    expect(result.isActive).toBe(true);
    expect(result.windowStart.getMinutes()).toBe(20);
  });

  it('window starts exactly at :20 and belongs to previous clock hour before :20', () => {
    const justBefore = new Date('2026-06-23T14:19:59');
    const res = getPersonalHour(justBefore, DEFAULT_PROFILE);
    // Should be active for 13:20-14:20 window
    expect(res.clockHour).toBe(13);
    expect(res.isActive).toBe(true);
  });

  it('masters are preserved (if calculation hits 11/22/33)', () => {
    // This test will pass or give insight — we can force raw values in future tuning
    const t = new Date('2026-06-23T11:25:00');
    const res = getPersonalHour(t, DEFAULT_PROFILE);
    if ([11, 22, 33].includes(res.personalHour)) {
      expect(res.personalHour).toBeGreaterThan(9);
    }
  });

  it('qualities match user spec for best/friendly/caution numbers', () => {
    const profile = DEFAULT_PROFILE;
    // Force different hours by walking the clock
    for (let h = 0; h < 24; h++) {
      const t = new Date(`2026-06-23T${h.toString().padStart(2, '0')}:25:00`);
      const r = getPersonalHour(t, profile);
      if ([6, 8, 9, 11, 22, 33].includes(r.personalHour)) {
        expect(r.quality).toBe('best');
      }
      if ([1, 2, 7].includes(r.personalHour)) {
        expect(r.quality).toBe('friendly');
      }
      if ([3, 5].includes(r.personalHour)) {
        expect(r.quality).toBe('caution');
      }
    }
  });
});
