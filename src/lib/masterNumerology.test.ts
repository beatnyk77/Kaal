import { describe, it, expect } from 'vitest';
import {
  getNumberProfile,
  getPHQuality,
  getNumberCompatibility,
  getZodiacAnimal,
  getZodiacSynergy,
  getPersonalYearPhase,
  evaluateCrossSystem,
  getPersonalHourMethod,
} from './masterNumerology';

describe('masterNumerology KB', () => {
  it('loads number profile 4 (user core)', () => {
    const p = getNumberProfile(4);
    expect(p?.label).toBe('The Builder');
    expect(p?.graha.primary).toBe('Rahu');
    expect(p?.friendly_numbers).toContain(8);
    expect(p?.enemy_numbers).toContain(5);
  });

  it('maps PH quality per arthouse33 table', () => {
    expect(getPHQuality(8)).toBe('best');
    expect(getPHQuality(7)).toBe('friendly');
    expect(getPHQuality(5)).toBe('caution');
    expect(getPHQuality(4)).toBe('neutral');
    expect(getPHQuality(22)).toBe('best');
  });

  it('resolves number compatibility matrix', () => {
    expect(getNumberCompatibility(4, 8)).toBe('ally');
    expect(getNumberCompatibility(4, 5)).toBe('enemy');
    expect(getNumberCompatibility(9, 8)).toBe('friendly');
  });

  it('loads Vietnamese Cat zodiac with Rooster enemy', () => {
    const cat = getZodiacAnimal('cat');
    expect(cat?.vietnamese_name).toBe('Mèo');
    expect(cat?.enemy_animals).toContain('rooster');
    expect(cat?.synergy_rules.triad).toContain('goat');
  });

  it('computes zodiac synergy', () => {
    expect(getZodiacSynergy('cat', 'goat')).toBe('friendly');
    expect(getZodiacSynergy('cat', 'rooster')).toBe('enemy');
    expect(getZodiacSynergy('cat', 'cat')).toBe('self');
  });

  it('exposes personal year phase 4', () => {
    const py4 = getPersonalYearPhase(4);
    expect(py4?.theme).toContain('Foundation');
  });

  it('personal hour method has 8 arthouse33 steps', () => {
    const method = getPersonalHourMethod();
    expect(method.steps).toHaveLength(8);
    expect(method.quality_lookup.tiers.best).toContain(8);
  });

  it('matches deal_window_high cross-system rule', () => {
    const result = evaluateCrossSystem({
      personal_hour: 8,
      personal_hour_quality: 'best',
      personal_day: 8,
      personal_year: 8,
      user_core: 4,
      zodiac_synergy: 'friendly',
      tithi_phase: 'shukla',
      yoga_strength: 'strong',
    });
    expect(result.matched_rules.some((m) => m.rule.id === 'deal_window_high')).toBe(true);
    expect(result.top_strength).toBe('very_high');
    expect(result.total_bias).toBeGreaterThan(0);
  });
});