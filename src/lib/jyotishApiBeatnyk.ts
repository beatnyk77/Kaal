/**
 * Client for beatnyk77/jyotish-api (kunjara/jyotish Symfony API).
 * @see https://github.com/beatnyk77/jyotish-api
 *
 * Endpoints:
 *   GET /api/ping
 *   GET /api/calculate
 */

import type { BirthChartProfile, DashaPeriod, JyotishContext, TransitHit } from './jyotishAdapter';
import { computeJyotishScore, normalizeDasha } from './jyotishAdapter';

export const BEATNYK_JYOTISH_DEFAULT_PORT = 9393;

const GRAHA_KEYS: Record<string, string> = {
  Su: 'Sun',
  Mo: 'Moon',
  Ma: 'Mars',
  Me: 'Mercury',
  Ju: 'Jupiter',
  Ve: 'Venus',
  Sa: 'Saturn',
  Ra: 'Rahu',
  Ke: 'Ketu',
};

const RASHI_NAMES: Record<number, string> = {
  1: 'Mesha',
  2: 'Vrishabha',
  3: 'Mithuna',
  4: 'Karka',
  5: 'Simha',
  6: 'Kanya',
  7: 'Tula',
  8: 'Vrishchika',
  9: 'Dhanu',
  10: 'Makara',
  11: 'Kumbha',
  12: 'Meena',
};

const LORD_NATURE: Record<string, DashaPeriod['nature']> = {
  Jupiter: 'supportive',
  Venus: 'supportive',
  Moon: 'supportive',
  Mercury: 'supportive',
  Sun: 'neutral',
  Saturn: 'challenging',
  Mars: 'challenging',
  Rahu: 'challenging',
  Ketu: 'challenging',
};

const DIGNITY_NATURE: Record<string, TransitHit['nature']> = {
  ucha: 'supportive',
  mool: 'supportive',
  swa: 'supportive',
  friend: 'supportive',
  neutral: 'neutral',
  enemy: 'challenging',
  neecha: 'challenging',
};

export interface BeatnykChartParams {
  latitude: number;
  longitude: number;
  year: number;
  month: number;
  day: number;
  hour: number;
  min: number;
  sec?: number;
  timeZone: string;
}

export interface BeatnykNatalSummary {
  lagnaRashi: number;
  lagnaSign: string;
  moonRashi: number;
  moonSign: string;
  moonNakshatra?: string;
}

export interface BeatnykJyotishOptions {
  baseUrl: string;
  timeoutMs?: number;
  nesting?: number;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function formatTimezone(offsetMinutes: number): string {
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMinutes);
  const hh = String(Math.floor(abs / 60)).padStart(2, '0');
  const mm = String(abs % 60).padStart(2, '0');
  return `${sign}${hh}:${mm}`;
}

export function birthToChartParams(
  birth: BirthChartProfile,
  datetime: Date
): BeatnykChartParams {
  const offset = birth.timezoneOffsetMinutes;
  const shifted = new Date(datetime.getTime() + offset * 60_000);
  return {
    latitude: birth.latitude,
    longitude: birth.longitude,
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    min: shifted.getUTCMinutes(),
    sec: shifted.getUTCSeconds(),
    timeZone: formatTimezone(offset),
  };
}

function apiBase(base: string): string {
  const root = base.replace(/\/$/, '');
  return root.endsWith('/api') ? root : `${root}/api`;
}

function resolveApiUrl(path: string): URL {
  if (path.startsWith('http://') || path.startsWith('https://')) return new URL(path);
  const origin =
    typeof globalThis !== 'undefined' && 'location' in globalThis
      ? (globalThis as Window & typeof globalThis).location.origin
      : 'http://localhost';
  return new URL(path, origin);
}

export function buildCalculateUrl(base: string, params: BeatnykChartParams, infolevel: string[]): string {
  const url = resolveApiUrl(`${apiBase(base)}/calculate`);
  url.searchParams.set('latitude', String(params.latitude));
  url.searchParams.set('longitude', String(params.longitude));
  url.searchParams.set('year', String(params.year));
  url.searchParams.set('month', String(params.month));
  url.searchParams.set('day', String(params.day));
  url.searchParams.set('hour', String(params.hour));
  url.searchParams.set('min', String(params.min));
  url.searchParams.set('sec', String(params.sec ?? 0));
  url.searchParams.set('time_zone', params.timeZone);
  url.searchParams.set('dst_hour', '0');
  url.searchParams.set('dst_min', '0');
  url.searchParams.set('nesting', '2');
  url.searchParams.set('varga', 'D1');
  if (infolevel.length) url.searchParams.set('infolevel', infolevel.join(','));
  return url.toString();
}

async function fetchChart(
  baseUrl: string,
  params: BeatnykChartParams,
  infolevel: string[],
  timeoutMs: number
): Promise<Record<string, unknown>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(buildCalculateUrl(baseUrl, params, infolevel), {
      method: 'GET',
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`jyotish-api HTTP ${res.status}`);
    const json = (await res.json()) as { chart?: Record<string, unknown> };
    if (!json.chart) throw new Error('jyotish-api: missing chart in response');
    return json.chart;
  } finally {
    clearTimeout(timer);
  }
}

function parseIsoBetween(start?: string, end?: string, at = new Date()): boolean {
  if (!start || !end) return false;
  const t = at.getTime();
  return t >= new Date(start).getTime() && t < new Date(end).getTime();
}

function grahaLordName(key: string): string {
  return GRAHA_KEYS[key] ?? key;
}

function findActiveDashaPeriod(
  periods: Record<string, unknown> | undefined,
  at: Date
): { maha?: string; antar?: string } {
  if (!periods) return {};

  for (const [lordKey, raw] of Object.entries(periods)) {
    const p = raw as Record<string, unknown>;
    if (!parseIsoBetween(String(p.start), String(p.end), at)) continue;

    const maha = grahaLordName(lordKey);
    let antar: string | undefined;

    const sub = p.periods as Record<string, unknown> | undefined;
    if (sub) {
      for (const [subKey, subRaw] of Object.entries(sub)) {
        const sp = subRaw as Record<string, unknown>;
        if (parseIsoBetween(String(sp.start), String(sp.end), at)) {
          antar = grahaLordName(subKey);
          break;
        }
      }
    }

    return { maha, antar };
  }

  return {};
}

export function parseNatalSummary(chart: Record<string, unknown>): BeatnykNatalSummary {
  const lagna = (chart.lagna as Record<string, Record<string, unknown>> | undefined)?.Lg;
  const moon = (chart.graha as Record<string, Record<string, unknown>> | undefined)?.Mo;
  const lagnaRashi = Number(lagna?.rashi ?? 0);
  const moonRashi = Number(moon?.rashi ?? 0);
  const moonNak = (moon?.nakshatra as Record<string, unknown> | undefined)?.name;

  return {
    lagnaRashi,
    lagnaSign: RASHI_NAMES[lagnaRashi] ?? `Rashi ${lagnaRashi}`,
    moonRashi,
    moonSign: RASHI_NAMES[moonRashi] ?? `Rashi ${moonRashi}`,
    moonNakshatra: moonNak != null ? String(moonNak) : undefined,
  };
}

function deriveTransits(
  natal: Record<string, unknown>,
  current: Record<string, unknown>
): TransitHit[] {
  const hits: TransitHit[] = [];
  const natalGraha = (natal.graha ?? {}) as Record<string, Record<string, unknown>>;
  const currentGraha = (current.graha ?? {}) as Record<string, Record<string, unknown>>;

  for (const [key, cur] of Object.entries(currentGraha)) {
    const planet = grahaLordName(key);
    const natalRashi = Number(natalGraha[key]?.rashi);
    const curRashi = Number(cur.rashi);
    const dignity = String(cur.rashiAvastha ?? 'neutral');
    const nature = DIGNITY_NATURE[dignity] ?? 'neutral';

    if (natalRashi && curRashi && natalRashi !== curRashi) {
      hits.push({
        planet,
        aspect: 'transit',
        target: `natal ${RASHI_NAMES[natalRashi] ?? natalRashi}`,
        nature,
        note: `${planet} transiting ${RASHI_NAMES[curRashi] ?? curRashi} (natal ${RASHI_NAMES[natalRashi] ?? natalRashi}) · ${dignity}`,
      });
      continue;
    }

    if (dignity === 'ucha' || dignity === 'swa' || dignity === 'neecha') {
      hits.push({
        planet,
        aspect: dignity,
        target: `natal ${planet}`,
        nature,
        note: `${planet} in ${dignity} (${RASHI_NAMES[curRashi] ?? curRashi})`,
      });
    }
  }

  const hora = (current.kala as Record<string, Record<string, unknown>> | undefined)?.hora;
  if (hora?.key) {
    hits.push({
      planet: grahaLordName(String(hora.key)),
      aspect: 'hora',
      target: 'current moment',
      nature: 'neutral',
      note: `Active hora lord: ${grahaLordName(String(hora.key))}`,
      personalHourInteraction: 'Hora lord modulates PH execution tone.',
    });
  }

  return hits.slice(0, 8);
}

export function parseDashaFromChart(chart: Record<string, unknown>, at: Date): DashaPeriod {
  const dashaRoot = chart.dasha as Record<string, unknown> | undefined;
  const active = findActiveDashaPeriod(
    (dashaRoot?.periods ?? dashaRoot) as Record<string, unknown> | undefined,
    at
  );

  const maha = active.maha ?? 'Unknown';
  const antar = active.antar;
  const nature = LORD_NATURE[maha] ?? 'neutral';

  return normalizeDasha({
    system: 'vimshottari',
    maha,
    antar,
    nature,
    note: `${maha}${antar ? `-${antar}` : ''} dasha (beatnyk77/jyotish-api).`,
  });
}

export async function fetchBeatnykJyotishContext(
  datetime: Date,
  birth: BirthChartProfile,
  opts: BeatnykJyotishOptions
): Promise<JyotishContext & { natal?: BeatnykNatalSummary }> {
  const timeoutMs = opts.timeoutMs ?? 12_000;
  const natalParams = birthToChartParams(birth, birthInstant(birth));
  const transitParams = birthToChartParams(birth, datetime);

  const [natalChart, currentChart] = await Promise.all([
    fetchChart(opts.baseUrl, natalParams, ['basic'], timeoutMs),
    fetchChart(opts.baseUrl, transitParams, ['basic', 'panchanga'], timeoutMs),
  ]);

  const natal = parseNatalSummary(natalChart);
  const dasha = parseDashaFromChart(currentChart, datetime);
  const transits = deriveTransits(natalChart, currentChart);
  const score = clamp(computeJyotishScore(dasha, transits), 15, 90);

  return {
    source: 'live',
    dasha,
    transits,
    score,
    summary: `Lagna ${natal.lagnaSign} · Moon ${natal.moonSign} · ${dasha.maha}/${dasha.antar ?? '—'} dasha · score ${score}`,
    fetchedAt: new Date().toISOString(),
    natal,
  };
}

function birthInstant(birth: BirthChartProfile): Date {
  const [y, m, d] = birth.birthDate.split('-').map(Number);
  const [hh, mm] = birth.birthTime.split(':').map(Number);
  const offset = birth.timezoneOffsetMinutes;
  return new Date(Date.UTC(y, m - 1, d, hh, mm) - offset * 60_000);
}

export async function checkBeatnykJyotishHealth(baseUrl: string, timeoutMs = 3000): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const url = `${apiBase(baseUrl)}/ping`;
    const res = await fetch(url, { method: 'GET', signal: controller.signal });
    if (!res.ok) return false;
    const json = (await res.json()) as { pong?: string };
    return json.pong === 'success';
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}