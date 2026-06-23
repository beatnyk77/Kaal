/**
 * Local jyotish-api dev server for Kala Phase 3.
 * bun run jyotish:api
 *
 * Implements:
 *   GET  /health
 *   POST /v1/dasha/current
 *   POST /v1/transits/active
 */

import { MhahPanchang } from 'mhah-panchang';

const PORT = Number(process.env.JYOTISH_API_PORT ?? 3001);
const panchang = new MhahPanchang();

const VIMSHOTTARI_LORDS = [
  'Ketu',
  'Venus',
  'Sun',
  'Moon',
  'Mars',
  'Rahu',
  'Jupiter',
  'Saturn',
  'Mercury',
] as const;

const LORD_YEARS: Record<string, number> = {
  Ketu: 7,
  Venus: 20,
  Sun: 6,
  Moon: 10,
  Mars: 7,
  Rahu: 18,
  Jupiter: 16,
  Saturn: 19,
  Mercury: 17,
};

const LORD_NATURE: Record<string, 'supportive' | 'neutral' | 'challenging'> = {
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

const NAKSHATRA_LORDS = [
  'Ketu',
  'Venus',
  'Sun',
  'Moon',
  'Mars',
  'Rahu',
  'Jupiter',
  'Saturn',
  'Mercury',
  'Ketu',
  'Venus',
  'Sun',
  'Moon',
  'Mars',
  'Rahu',
  'Jupiter',
  'Saturn',
  'Mercury',
  'Ketu',
  'Venus',
  'Sun',
  'Moon',
  'Mars',
  'Rahu',
  'Jupiter',
  'Saturn',
  'Mercury',
] as const;

interface ApiBirth {
  date: string;
  time: string;
  lat: number;
  lon: number;
  tz_offset_minutes: number;
}

interface ApiBody {
  datetime: string;
  birth: ApiBirth;
}

function parseBody(req: Request): Promise<ApiBody> {
  return req.json() as Promise<ApiBody>;
}

function birthInstant(birth: ApiBirth): Date {
  const [y, m, d] = birth.date.split('-').map(Number);
  const [hh, mm] = birth.time.split(':').map(Number);
  const offset = birth.tz_offset_minutes ?? 330;
  const utcMs = Date.UTC(y, m - 1, d, hh, mm) - offset * 60_000;
  return new Date(utcMs);
}

function nakshatraIndexAt(date: Date): number {
  const r = panchang.calculate(date) as { Nakshatra?: { name_en_IN?: string } };
  const name = r.Nakshatra?.name_en_IN ?? 'Ashwini';
  const names = [
    'Ashwini',
    'Bharani',
    'Krittika',
    'Rohini',
    'Mrigashira',
    'Ardra',
    'Punarvasu',
    'Pushya',
    'Ashlesha',
    'Magha',
    'Purva Phalguni',
    'Uttara Phalguni',
    'Hasta',
    'Chitra',
    'Swati',
    'Vishakha',
    'Anuradha',
    'Jyeshtha',
    'Mula',
    'Purva Ashadha',
    'Uttara Ashadha',
    'Shravana',
    'Dhanishta',
    'Shatabhisha',
    'Purva Bhadrapada',
    'Uttara Bhadrapada',
    'Revati',
  ];
  const idx = names.findIndex((n) => n.toLowerCase() === name.toLowerCase());
  return idx >= 0 ? idx : 0;
}

function vimshottariAt(datetime: Date, birth: ApiBirth) {
  const birthLord = NAKSHATRA_LORDS[nakshatraIndexAt(birthInstant(birth))];
  const startIdx = VIMSHOTTARI_LORDS.indexOf(birthLord as (typeof VIMSHOTTARI_LORDS)[number]);
  const ageYears = (datetime.getTime() - birthInstant(birth).getTime()) / (365.25 * 24 * 3600_000);

  let cursor = 0;
  let maha = birthLord;
  let antar = birthLord;
  let remainingInMaha = LORD_YEARS[birthLord] ?? 10;

  for (let cycle = 0; cycle < 9; cycle++) {
    const lord = VIMSHOTTARI_LORDS[(startIdx + cycle) % 9];
    const years = LORD_YEARS[lord] ?? 10;
    if (ageYears < cursor + years) {
      maha = lord;
      remainingInMaha = cursor + years - ageYears;
      const antarAge = ageYears - cursor;
      let antCursor = 0;
      for (let a = 0; a < 9; a++) {
        const alord = VIMSHOTTARI_LORDS[(startIdx + cycle + a) % 9];
        const aYears = (LORD_YEARS[alord] ?? 10) * (years / 120);
        if (antarAge < antCursor + aYears) {
          antar = alord;
          break;
        }
        antCursor += aYears;
      }
      break;
    }
    cursor += years;
  }

  return { maha, antar, remainingInMaha };
}

function computeScore(
  dashaNature: 'supportive' | 'neutral' | 'challenging',
  transits: Array<{ nature: string }>
): number {
  let score = 50;
  if (dashaNature === 'supportive') score += 12;
  if (dashaNature === 'challenging') score -= 10;
  for (const t of transits) {
    if (t.nature === 'supportive') score += 5;
    if (t.nature === 'challenging') score -= 6;
  }
  return Math.max(15, Math.min(90, Math.round(score)));
}

function dashaHandler(body: ApiBody) {
  const dt = new Date(body.datetime);
  const { maha, antar, remainingInMaha } = vimshottariAt(dt, body.birth);
  const nature = LORD_NATURE[maha] ?? 'neutral';

  const dasha = {
    system: 'vimshottari',
    maha,
    antar,
    remainingYears: Math.round(remainingInMaha * 10) / 10,
    nature,
    note:
      nature === 'supportive'
        ? `${maha}-${antar}: supportive macro channel for material execution and deals.`
        : nature === 'challenging'
          ? `${maha}-${antar}: patience required — protect foundation, avoid forced timelines.`
          : `${maha}-${antar}: neutral dasha — routine structural work favored.`,
  };

  return { dasha, score: computeScore(nature, []), summary: `Vimshottari ${maha}/${antar} active.` };
}

function transitsHandler(body: ApiBody) {
  const dt = new Date(body.datetime);
  const seed = dt.getUTCDate() + dt.getUTCMonth() * 3 + dt.getUTCHours();
  const { maha, antar } = vimshottariAt(dt, body.birth);

  const transits = [
    {
      planet: 'Jupiter',
      aspect: seed % 2 === 0 ? 'trine' : 'sextile',
      target: 'natal Moon',
      nature: 'supportive' as const,
      note: 'Jupiter supports visibility and structured growth.',
      personalHourInteraction: 'Jupiter widens PH execution bandwidth for Core 4 builder moves.',
    },
    {
      planet: seed % 3 === 0 ? 'Saturn' : 'Mars',
      aspect: 'square',
      target: `natal ${seed % 2 === 0 ? 'Saturn' : 'Mercury'}`,
      nature: 'challenging' as const,
      note: 'Friction transit — defer impulsive pivots this hour.',
      personalHourInteraction: 'Square tones down high-conviction PH unless master/best tier.',
    },
  ];

  const dashaNature = LORD_NATURE[maha] ?? 'neutral';
  const score = computeScore(dashaNature, transits);

  return {
    transits,
    score,
    summary: `Active transits under ${maha}/${antar} dasha backdrop.`,
  };
}

function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  });
}

Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);

    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    if (req.method === 'GET' && url.pathname === '/health') {
      return json({ ok: true, service: 'kala-jyotish-api-dev', version: '0.1.0' });
    }

    if (req.method === 'POST' && url.pathname === '/v1/dasha/current') {
      const body = await parseBody(req);
      return json(dashaHandler(body));
    }

    if (req.method === 'POST' && url.pathname === '/v1/transits/active') {
      const body = await parseBody(req);
      return json(transitsHandler(body));
    }

    return json({ error: 'not_found' }, 404);
  },
});

console.log(`jyotish-api dev server → http://localhost:${PORT}`);
console.log('  GET  /health');
console.log('  POST /v1/dasha/current');
console.log('  POST /v1/transits/active');