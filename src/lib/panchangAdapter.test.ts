import { describe, it, expect } from 'vitest';
import { getPanchang } from './panchangAdapter';
import { calculatePanchang } from './panchangJS/calculator';

describe('Panchang (real calculator)', () => {
  const ist1528 = new Date('2026-06-23T15:28:00+05:30');

  it('returns panchangJS-backed panchang for IST datetime', () => {
    const p = getPanchang(ist1528);
    expect(p.tithi.name).toMatch(/Shukla Navami/i);
    expect(p.nakshatra.name).toBe('Chitra');
    expect(p.yoga.name).toBe('Parigha');
    expect(p.vara).toBe('Tuesday');
    expect(p.muhurta.score).toBeLessThan(60);
  });

  it('calculatePanchang uses beatnyk panchangJS by default', () => {
    const c = calculatePanchang(ist1528, 330);
    expect(c.tithi).toMatch(/Shukla Navami/i);
    expect(c.nakshatra).toBe('Chitra');
    expect(c.yoga).toBe('Parigha');
    expect(c.source).toBe('panchangJS');
  });

  it('mhah-panchang backend remains available', () => {
    const c = calculatePanchang(ist1528, 330, 'mhah-panchang');
    expect(c.source).toBe('mhah-panchang');
    expect(c.nakshatra).toBe('Chitra');
  });
});