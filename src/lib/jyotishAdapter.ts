/**
 * JyotishAdapter — client for jyotish-api (live) with stub/fallback.
 *
 * Routes:
 *   POST /v1/dasha/current
 *   POST /v1/transits/active
 *   GET  /health
 */

export interface BirthChartProfile {
  birthDate: string;
  birthTime: string;
  latitude: number;
  longitude: number;
  timezoneOffsetMinutes: number;
}

export interface DashaPeriod {
  system: 'vimshottari' | 'yogini' | string;
  maha: string;
  antar?: string;
  pratyantar?: string;
  remainingYears?: number;
  nature: 'supportive' | 'neutral' | 'challenging';
  note: string;
}

export interface TransitHit {
  planet: string;
  aspect: string;
  target: string;
  orb?: number;
  nature: 'supportive' | 'neutral' | 'challenging';
  note: string;
  personalHourInteraction?: string;
}

export type JyotishSource = 'live' | 'stub' | 'fallback';

export interface JyotishContext {
  source: JyotishSource;
  dasha: DashaPeriod;
  transits: TransitHit[];
  score: number;
  summary: string;
  fetchedAt: string;
  error?: string;
}

export interface JyotishAdapterOptions {
  baseUrl?: string;
  apiKey?: string;
  useStub?: boolean;
  timeoutMs?: number;
}

const DEFAULT_JYOTISH_BASE = 'http://localhost:3001';

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

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function asNature(value: unknown): DashaPeriod['nature'] {
  if (value === 'supportive' || value === 'challenging') return value;
  return 'neutral';
}

export function normalizeDasha(raw: unknown): DashaPeriod {
  const d = (raw ?? {}) as Record<string, unknown>;
  const maha = String(d.maha ?? d.maha_lord ?? d.mahadasha ?? d.lord ?? 'Unknown');
  const antar = d.antar ?? d.antar_lord ?? d.antardasha;
  return {
    system: (d.system as DashaPeriod['system']) ?? 'vimshottari',
    maha,
    antar: antar != null ? String(antar) : undefined,
    pratyantar: d.pratyantar != null ? String(d.pratyantar) : undefined,
    remainingYears: typeof d.remainingYears === 'number' ? d.remainingYears : undefined,
    nature: asNature(d.nature ?? LORD_NATURE[maha]),
    note: String(d.note ?? `${maha}${antar ? `-${antar}` : ''} dasha period active.`),
  };
}

function normalizeTransit(raw: unknown): TransitHit | null {
  if (!raw || typeof raw !== 'object') return null;
  const t = raw as Record<string, unknown>;
  const planet = String(t.planet ?? t.graha ?? 'Planet');
  const aspect = String(t.aspect ?? t.type ?? 'aspect');
  const target = String(t.target ?? t.natal ?? 'natal');
  return {
    planet,
    aspect,
    target,
    orb: typeof t.orb === 'number' ? t.orb : undefined,
    nature: asNature(t.nature),
    note: String(t.note ?? `${planet} ${aspect} ${target}`),
    personalHourInteraction:
      t.personalHourInteraction != null ? String(t.personalHourInteraction) : undefined,
  };
}

export function computeJyotishScore(dasha: DashaPeriod, transits: TransitHit[]): number {
  let score = 50;
  if (dasha.nature === 'supportive') score += 12;
  else if (dasha.nature === 'challenging') score -= 10;

  for (const t of transits) {
    if (t.nature === 'supportive') score += 5;
    else if (t.nature === 'challenging') score -= 6;
  }

  return clamp(Math.round(score), 15, 90);
}

function buildSummary(dasha: DashaPeriod, transits: TransitHit[], score: number): string {
  const supportive = transits.filter((t) => t.nature === 'supportive').length;
  const challenging = transits.filter((t) => t.nature === 'challenging').length;
  return `Dasha ${dasha.maha}/${dasha.antar ?? '—'} (${dasha.nature}) · ${supportive} supportive / ${challenging} challenging transits · score ${score}`;
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJyotishLive(
  datetime: Date,
  birth: BirthChartProfile,
  opts: JyotishAdapterOptions
): Promise<JyotishContext> {
  const base = (opts.baseUrl ?? DEFAULT_JYOTISH_BASE).replace(/\/$/, '');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts.apiKey) headers.Authorization = `Bearer ${opts.apiKey}`;

  const body = {
    datetime: datetime.toISOString(),
    birth: {
      date: birth.birthDate,
      time: birth.birthTime,
      lat: birth.latitude,
      lon: birth.longitude,
      tz_offset_minutes: birth.timezoneOffsetMinutes,
    },
  };

  const timeoutMs = opts.timeoutMs ?? 8000;

  const [dashaRes, transitRes] = await Promise.all([
    fetchWithTimeout(`${base}/v1/dasha/current`, { method: 'POST', headers, body: JSON.stringify(body) }, timeoutMs),
    fetchWithTimeout(`${base}/v1/transits/active`, { method: 'POST', headers, body: JSON.stringify(body) }, timeoutMs),
  ]);

  if (!dashaRes.ok || !transitRes.ok) {
    throw new Error(`jyotish-api HTTP dasha=${dashaRes.status} transits=${transitRes.status}`);
  }

  const dashaJson = (await dashaRes.json()) as Record<string, unknown>;
  const transitJson = (await transitRes.json()) as Record<string, unknown>;

  const dasha = normalizeDasha(dashaJson.dasha ?? dashaJson);
  const rawTransits = (transitJson.transits ?? transitJson.hits ?? []) as unknown[];
  const transits = rawTransits.map(normalizeTransit).filter((t): t is TransitHit => t != null);

  const score = clamp(
    Math.round(
      Number(transitJson.score ?? dashaJson.score) ||
        computeJyotishScore(dasha, transits)
    ),
    15,
    90
  );

  const summary = String(
    transitJson.summary ?? dashaJson.summary ?? buildSummary(dasha, transits, score)
  );

  return {
    source: 'live',
    dasha,
    transits,
    score,
    summary,
    fetchedAt: new Date().toISOString(),
  };
}

/** Deterministic stub when API disabled or unavailable */
export function stubJyotishContext(datetime: Date, birth: BirthChartProfile): JyotishContext {
  const seed = Math.floor(
    datetime.getUTCDate() +
      datetime.getUTCMonth() +
      datetime.getUTCHours() +
      birth.latitude +
      birth.longitude
  );
  const supportive = seed % 3 !== 0;
  const mahaIdx = ((seed % VIMSHOTTARI_LORDS.length) + VIMSHOTTARI_LORDS.length) % VIMSHOTTARI_LORDS.length;

  const dasha: DashaPeriod = {
    system: 'vimshottari',
    maha: VIMSHOTTARI_LORDS[mahaIdx],
    antar: VIMSHOTTARI_LORDS[(mahaIdx + 2) % VIMSHOTTARI_LORDS.length],
    nature: supportive ? 'supportive' : 'neutral',
    note: supportive
      ? 'Stub dasha — structure + commerce tone; favors contracts and disciplined execution.'
      : 'Stub dasha — mixed tone; steady work over speculation.',
  };

  const transits: TransitHit[] = [
    {
      planet: 'Jupiter',
      aspect: 'trine',
      target: 'natal Rahu',
      nature: 'supportive',
      note: 'Expansion around unconventional systems — good for building new frameworks.',
      personalHourInteraction: 'Amplifies PH themes when Jupiter is supportive.',
    },
    {
      planet: 'Mars',
      aspect: 'square',
      target: 'natal Saturn',
      nature: 'challenging',
      note: 'Friction on patience — avoid forcing timelines in this hour.',
      personalHourInteraction: 'Caution on impulsive moves during friendly (not best) Personal Hours.',
    },
  ];

  const score = computeJyotishScore(dasha, transits);

  return {
    source: 'stub',
    dasha,
    transits,
    score,
    summary: buildSummary(dasha, transits, score),
    fetchedAt: new Date().toISOString(),
  };
}

export async function checkJyotishApiHealth(baseUrl: string, timeoutMs = 3000): Promise<boolean> {
  try {
    const base = baseUrl.replace(/\/$/, '');
    const res = await fetchWithTimeout(`${base}/health`, { method: 'GET' }, timeoutMs);
    return res.ok;
  } catch {
    return false;
  }
}

export async function getJyotishContext(
  datetime: Date,
  birth: BirthChartProfile,
  opts: JyotishAdapterOptions = {}
): Promise<JyotishContext> {
  if (opts.useStub || !opts.baseUrl) {
    return stubJyotishContext(datetime, birth);
  }

  try {
    return await fetchJyotishLive(datetime, birth, opts);
  } catch (err) {
    const fallback = stubJyotishContext(datetime, birth);
    return {
      ...fallback,
      source: 'fallback',
      error: err instanceof Error ? err.message : 'jyotish-api unavailable',
    };
  }
}