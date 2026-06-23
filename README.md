# Kaal — Personal Kaal-Chakra Intelligence Engine

Your unified daily/hourly timing advisor combining Personal Hours, Panchang, Jyotish, GG33 + Vietnamese numerology, and self-learning from your action logs.

**Default birth anchor**: 20:20 → BTN=4, Core=4, transition :20, IST (+330).

## Run locally

```bash
bun install
bun dev              # Vite app at http://localhost:5173
bun test             # engine + intelligence tests
bun run build        # production build → dist/
bun run verify:ph    # sample Personal Hours table
```

### Optional: live Jyotish API (Phase 3)

```bash
bun run jyotish:api  # mock vimshottari API on :3001
```

Copy `.env.example` → `.env`. Default `VITE_JYOTISH_API_URL=/jyotish-api` proxies via Vite dev server.

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