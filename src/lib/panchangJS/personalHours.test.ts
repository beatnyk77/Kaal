import { describe, it, expect } from 'vitest';
import {
  calculatePersonalHour,
  getCurrentPersonalHour,
  computeBirthTimeNumber,
  parseBirthTime,
  profileFromBirthTime,
  reduceUnlessMaster,
  isMasterNumber,
  getPersonalHourQuality,
  getPrevious11PM,
  getActiveClockHour,
  DEFAULT_PERSONAL_HOUR_PROFILE,
  IST_OFFSET_MINUTES,
  getWallClock,
} from './personalHours';

const PROFILE = DEFAULT_PERSONAL_HOUR_PROFILE;
const TZ = IST_OFFSET_MINUTES;
const ist = (isoLocal: string) => new Date(isoLocal);

function ph(input: Omit<Parameters<typeof calculatePersonalHour>[0], 'timezoneOffsetMinutes'>) {
  return calculatePersonalHour({ ...input, timezoneOffsetMinutes: TZ });
}

describe('parseBirthTime & BTN', () => {
  it('parses 20:20', () => {
    expect(parseBirthTime('20:20')).toEqual({ hour: 20, minute: 20 });
  });

  it('computes BTN 4 from 20:20', () => {
    expect(computeBirthTimeNumber(20, 20)).toBe(4);
  });

  it('profileFromBirthTime sets transition minute from birth minute', () => {
    const p = profileFromBirthTime('20:20', { coreNumber: 4 });
    expect(p.btn).toBe(4);
    expect(p.transitionMinute).toBe(20);
    expect(p.coreNumber).toBe(4);
  });

  it('rejects invalid birth time', () => {
    expect(() => parseBirthTime('25:00')).toThrow();
    expect(() => parseBirthTime('invalid')).toThrow();
  });
});

describe('reduceUnlessMaster', () => {
  it('preserves masters on raw sum only', () => {
    expect(reduceUnlessMaster(11)).toBe(11);
    expect(reduceUnlessMaster(22)).toBe(22);
    expect(reduceUnlessMaster(33)).toBe(33);
  });

  it('reduces non-masters', () => {
    expect(reduceUnlessMaster(20)).toBe(2);
    expect(reduceUnlessMaster(29)).toBe(2); // 2+9=11 → 1+1=2 (11 not preserved mid-reduce)
  });

  it('isMasterNumber identifies 11/22/33', () => {
    expect(isMasterNumber(11)).toBe(true);
    expect(isMasterNumber(7)).toBe(false);
  });
});

describe('quality tiers (arthouse33)', () => {
  it('maps tiers correctly', () => {
    expect(getPersonalHourQuality(8)).toBe('best');
    expect(getPersonalHourQuality(11)).toBe('best');
    expect(getPersonalHourQuality(22)).toBe('best');
    expect(getPersonalHourQuality(1)).toBe('friendly');
    expect(getPersonalHourQuality(7)).toBe('friendly');
    expect(getPersonalHourQuality(3)).toBe('caution');
    expect(getPersonalHourQuality(5)).toBe('caution');
    expect(getPersonalHourQuality(4)).toBe('neutral');
  });
});

describe('transition minute boundary', () => {
  it('before :20 belongs to previous clock hour window', () => {
    const r = ph({ profile: PROFILE, targetDateTime: ist('2026-06-23T15:19:59+05:30') });
    expect(r.clockHour).toBe(14);
    expect(r.isActive).toBe(true);
    const ws = getWallClock(r.windowStart, TZ);
    const we = getWallClock(r.windowEnd, TZ);
    expect(ws.hour).toBe(14);
    expect(ws.minute).toBe(20);
    expect(we.hour).toBe(15);
    expect(we.minute).toBe(20);
  });

  it('at exactly :20 activates current hour window', () => {
    const r = ph({ profile: PROFILE, targetDateTime: ist('2026-06-23T20:20:00+05:30') });
    expect(r.clockHour).toBe(20);
    expect(r.isActive).toBe(true);
    const ws = getWallClock(r.windowStart, TZ);
    expect(ws.hour).toBe(20);
    expect(ws.minute).toBe(20);
  });

  it('just after :20 is active in current hour window', () => {
    const r = ph({ profile: PROFILE, targetDateTime: ist('2026-06-23T15:28:00+05:30') });
    expect(r.clockHour).toBe(15);
    expect(r.isActive).toBe(true);
  });
});

describe('midnight edge cases', () => {
  it('00:25 after midnight uses hour 0 window', () => {
    const r = ph({ profile: PROFILE, targetDateTime: ist('2026-06-24T00:25:00+05:30') });
    expect(r.clockHour).toBe(0);
    expect(r.personalHour).toBe(5);
    expect(r.quality).toBe('caution');
  });

  it('23:19 is still in hour 22 window', () => {
    const r = ph({ profile: PROFILE, targetDateTime: ist('2026-06-23T23:19:59+05:30') });
    expect(r.clockHour).toBe(22);
    expect(r.personalHour).toBe(3);
    expect(r.quality).toBe('caution');
  });

  it('23:25 starts hour 23 window', () => {
    const r = ph({ profile: PROFILE, targetDateTime: ist('2026-06-23T23:25:00+05:30') });
    expect(r.clockHour).toBe(23);
    expect(r.personalHour).toBe(4);
    expect(r.quality).toBe('neutral');
  });

  it('getPrevious11PM before midnight uses previous-night 23:00', () => {
    const before = ist('2026-06-23T15:00:00+05:30');
    const ref = getPrevious11PM(before, TZ);
    const refWall = getWallClock(ref, TZ);
    expect(refWall.day).toBe(22);
    expect(refWall.hour).toBe(23);
    expect(refWall.minute).toBe(0);
  });
});

describe('master number windows', () => {
  it('06:25 on 2026-06-24 yields PH 11 (master, best)', () => {
    const r = ph({ profile: PROFILE, targetDateTime: ist('2026-06-24T06:25:00+05:30') });
    expect(r.hourCount).toBe(7);
    expect(r.rawSum).toBe(11);
    expect(r.isMaster).toBe(true);
    expect(r.personalHour).toBe(11);
    expect(r.quality).toBe('best');
    expect(r.recommendationsSeed.isMaster).toBe(true);
  });

  it('rawSum 22 preserved as master', () => {
    // BTN 4 + hourCount 18 = 22 → clock hour 17 on same anchor day
    const r = ph({ profile: PROFILE, targetDateTime: ist('2026-06-23T17:25:00+05:30') });
    expect(r.rawSum).toBe(22);
    expect(r.isMaster).toBe(true);
    expect(r.personalHour).toBe(22);
    expect(r.quality).toBe('best');
  });
});

describe('Kartikay examples — birth 20:20, 2026-06-23 IST', () => {
  it('15:28 IST → PH 2 friendly', () => {
    const r = ph({ birthTime: '20:20', targetDateTime: ist('2026-06-23T15:28:00+05:30') });
    expect(r.personalHour).toBe(2);
    expect(r.quality).toBe('friendly');
    expect(r.hourCount).toBe(16);
    expect(r.rawSum).toBe(20);
    expect(r.isMaster).toBe(false);
    expect(r.recommendationsSeed.tier).toBe('friendly');
    expect(r.recommendationsSeed.focus.length).toBeGreaterThan(0);
  });

  it('20:20 IST → PH 7 friendly (birth-hour mirror)', () => {
    const r = ph({ birthTime: '20:20', targetDateTime: ist('2026-06-23T20:20:00+05:30') });
    expect(r.personalHour).toBe(7);
    expect(r.quality).toBe('friendly');
    expect(r.hourCount).toBe(21);
    expect(r.rawSum).toBe(25);
    expect(r.isActive).toBe(true);
  });
});

describe('input modes', () => {
  it('accepts birthTime string', () => {
    const r = ph({ birthTime: '20:20', targetDateTime: ist('2026-06-23T15:28:00+05:30') });
    expect(r.personalHour).toBe(2);
  });

  it('accepts precomputed profile', () => {
    const r = ph({ profile: { btn: 4, transitionMinute: 20 }, targetDateTime: ist('2026-06-23T15:28:00+05:30') });
    expect(r.personalHour).toBe(2);
  });

  it('requires birthTime or profile', () => {
    expect(() =>
      calculatePersonalHour({ targetDateTime: new Date() } as never)
    ).toThrow();
  });
});

describe('getCurrentPersonalHour', () => {
  it('returns result for default profile', () => {
    const r = getCurrentPersonalHour(PROFILE, ist('2026-06-23T20:20:00+05:30'), TZ);
    expect(r.personalHour).toBe(7);
  });
});

describe('active clock hour helper', () => {
  it('getActiveClockHour wraps at midnight', () => {
    const d = ist('2026-06-24T00:10:00+05:30');
    expect(getActiveClockHour(d, 20, TZ)).toBe(23);
  });
});