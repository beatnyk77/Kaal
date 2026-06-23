# Kaal — Personal Kaal-Chakra Intelligence Engine

Your unified daily/hourly timing advisor combining Personal Hours, Panchang, Jyotish, GG33 + Vietnamese numerology, and self-learning from your action logs.

**Default birth anchor**: 20:20 → BTN=4, Core=4, transition :20, IST (+330).

## Run locally

```bash
bun install
bun run setup:vendor # required once — clones panchangJS + jyotish-api
bun dev              # Vite app at http://localhost:5173
bun test             # engine + intelligence tests
bun run build        # production build → dist/
bun run verify:ph    # sample Personal Hours table
```

### Vendor integrations (beatnyk77 forks)

```bash
bun run setup:vendor   # clone panchangJS + jyotish-api into vendor/
```

| Repo | Role in Kaal |
|------|----------------|
| [beatnyk77/panchangJS](https://github.com/beatnyk77/panchangJS) | Default panchang engine (`VITE_PANCHANG_BACKEND=panchangJS`) |
| [beatnyk77/jyotish-api](https://github.com/beatnyk77/jyotish-api) | Live Vimshottari dasha, lagna, moon, transits via Docker |

### Live Jyotish API

```bash
bun run setup:vendor
bun run jyotish:docker   # Symfony API on :9393 — GET /api/calculate
bun dev                  # proxies /jyotish-api → :9393
```

Copy `.env.example` → `.env`. Default:

- `VITE_PANCHANG_BACKEND=panchangJS` (mhah-panchang fallback if vendor missing)
- `VITE_JYOTISH_API_URL=/jyotish-api`
- `VITE_JYOTISH_API_MODE=beatnyk` (auto-detected)

Legacy bun mock (`jyotish:api:legacy` on :3001): set `VITE_JYOTISH_API_MODE=legacy`.

For static deploy without an API, set `VITE_JYOTISH_USE_STUB=true`.

## App tabs

| Tab | Purpose |
|-----|---------|
| **Advisor** | Hybrid timing advice (PH + panchang + jyotish + learned rules) |
| **Log Action** | Record outcomes; feeds pattern recognizer |
| **Intelligence** | PH heatmaps, combo scores, conviction calibration |
| **Planner** | Day/week deal windows, ICS export, browser + SW alerts |
| **Settings** | Edit profile, export/import JSON, PWA install |

## Storage

- **SQLite** (sql.js + IndexedDB) when available — shown in nav
- **localStorage** fallback (`kaal_intelligence_v1`) if IndexedDB fails

## Phase status

| Phase | Feature |
|-------|---------|
| 1 | E2E UI — Advisor, Log Action, persistence |
| 2 | Real panchang (`mhah-panchang`) + SQLite store |
| 3 | Live jyotish client + dev API proxy |
| 4 | Intelligence dashboard |
| 5 | Deal Planner — timeline, ICS, tab-open alerts |
| 6 | Settings, export/import, PWA + background SW alerts, Vercel deploy |

## Deploy (Vercel)

```bash
bun run build
# Deploy dist/ — vercel.json provides SPA fallback
```

Environment variables (optional):

- `VITE_JYOTISH_API_URL` — production jyotish API base URL
- `VITE_JYOTISH_USE_STUB=true` — skip live API on static hosting

## Personal Hours engine

Core rules in `src/lib/panchangJS/personalHours.ts`:

- Count full hours from 11 PM (23:00) previous night
- Window activates at birth minute (:20) past the clock hour
- Reduce to single digit unless Master (11/22/33)
- Quality: best=[6,8,9,11,22,33], friendly=[1,2,7], caution=[3,5]

Local-first. Your data, your timing model.