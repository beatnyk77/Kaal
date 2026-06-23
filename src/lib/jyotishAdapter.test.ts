import { describe, it, expect, afterEach } from 'vitest';
import {
  computeJyotishScore,
  getJyotishContext,
  normalizeDasha,
  type BirthChartProfile,
} from './jyotishAdapter';

const BIRTH: BirthChartProfile = {
  birthDate: '1992-05-15',
  birthTime: '20:20',
  latitude: 28.6139,
  longitude: 77.209,
  timezoneOffsetMinutes: 330,
};

describe('jyotishAdapter', () => {
  afterEach(() => {
    globalThis.fetch = fetch;
  });

  it('computeJyotishScore weights dasha and transits', () => {
    const dasha = normalizeDasha({ maha: 'Jupiter', antar: 'Venus', nature: 'supportive' });
    const transits = [
      { planet: 'Jupiter', aspect: 'trine', target: 'Moon', nature: 'supportive' as const, note: 'ok' },
      { planet: 'Mars', aspect: 'square', target: 'Saturn', nature: 'challenging' as const, note: 'caution' },
    ];
    const score = computeJyotishScore(dasha, transits);
    expect(score).toBeGreaterThan(50);
    expect(score).toBeLessThanOrEqual(90);
  });

  it('returns stub when useStub is true', async () => {
    const dt = new Date('2026-06-23T15:28:00+05:30');
    const ctx = await getJyotishContext(dt, BIRTH, { useStub: true });
    expect(ctx.source).toBe('stub');
    expect(ctx.dasha.maha).toBeTruthy();
    expect(ctx.transits.length).toBeGreaterThan(0);
  });

  it('parses live API responses', async () => {
    const dt = new Date('2026-06-23T15:28:00+05:30');

    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/v1/dasha/current')) {
        return new Response(
          JSON.stringify({
            dasha: {
              maha: 'Saturn',
              antar: 'Mercury',
              nature: 'neutral',
              note: 'Saturn-Mercury operational tone.',
            },
            score: 55,
          }),
          { status: 200 }
        );
      }
      if (url.endsWith('/v1/transits/active')) {
        return new Response(
          JSON.stringify({
            transits: [
              {
                planet: 'Jupiter',
                aspect: 'trine',
                target: 'natal Moon',
                nature: 'supportive',
                note: 'Growth window.',
              },
            ],
            score: 61,
          }),
          { status: 200 }
        );
      }
      return new Response('not found', { status: 404 });
    }) as typeof fetch;

    const ctx = await getJyotishContext(dt, BIRTH, {
      baseUrl: 'http://test.local',
      useStub: false,
      timeoutMs: 2000,
    });

    expect(ctx.source).toBe('live');
    expect(ctx.dasha.maha).toBe('Saturn');
    expect(ctx.dasha.antar).toBe('Mercury');
    expect(ctx.transits[0].planet).toBe('Jupiter');
    expect(ctx.score).toBe(61);
  });

  it('falls back to stub when API fails', async () => {
    globalThis.fetch = (async () => {
      throw new Error('network down');
    }) as typeof fetch;

    const ctx = await getJyotishContext(new Date('2026-06-23T15:28:00+05:30'), BIRTH, {
      baseUrl: 'http://test.local',
      useStub: false,
    });

    expect(ctx.source).toBe('fallback');
    expect(ctx.error).toContain('network');
    expect(ctx.dasha.maha).toBeTruthy();
    expect(ctx.transits.length).toBeGreaterThan(0);
  });
});