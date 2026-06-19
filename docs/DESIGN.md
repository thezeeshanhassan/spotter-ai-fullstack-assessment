# Design & Implementation

How the ELD Trip Planner is built: architecture, tech choices, module structure,
key data flows, design decisions, testing, and deployment.

For the domain rules (HOS), see [HOURS-OF-SERVICE.md](HOURS-OF-SERVICE.md).

---

## 1. Goal

Take trip details (current / pickup / dropoff location + current cycle hours) and
output (a) a route map with required stops/rests and (b) filled-out FMCSA daily
log sheets. Deliverables: hosted app, GitHub repo, Loom walkthrough.

---

## 2. Architecture

```
┌────────────────────────────┐         ┌──────────────────────────────┐        ┌──────────────────┐
│  React SPA (Vite + TS)     │  HTTPS  │  Django + DRF API            │  HTTPS │ OpenRouteService  │
│  - TripForm + autocomplete │ ──────▶ │  /api/geocode/  (proxy)      │ ─────▶ │ geocode / route / │
│  - RouteMap (Leaflet)      │         │  /api/trips/    (create)     │        │ autocomplete      │
│  - EldLogSheet (SVG)       │ ◀────── │  /api/trips/<id>/ (fetch)    │ ◀───── │                   │
│  - DaySelector, PDF export │  JSON   │  HOS engine (pure module)    │        └──────────────────┘
└────────────────────────────┘         │  SQLite (Trip/Stop/LogDay)   │
        Vercel                          └──────────────────────────────┘
                                                  Render
```

- The frontend never talks to OpenRouteService directly — the **API key stays
  server-side**; the backend proxies geocoding/routing/autocomplete.
- The **HOS engine is a pure Python module** (no Django imports) so the graded
  accuracy logic is isolated and unit-tested in isolation.

---

## 3. Tech stack & why

| Layer | Choice | Reason |
|-------|--------|--------|
| Frontend | Vite + React + TypeScript | Fast dev, typed, SPA fits a single planning screen. |
| Styling | Tailwind + shadcn-style primitives | Rapid, consistent, dark/light theming via CSS vars. |
| Map | Leaflet + OpenStreetMap (Carto tiles) | Free, no key for tiles; light/dark tile sets. |
| Geocode + routing | OpenRouteService | Free API, gives geometry + per-leg distances + autocomplete. |
| Backend | Django + Django REST Framework | Batteries-included, clean serializers/validation. |
| DB | SQLite | Zero-config persistence; trips are shareable/reloadable. |
| Logs export | jsPDF + html2canvas | Client-side multi-page PDF of the SVG sheets. |
| Hosting | Vercel (FE) + Render (BE) | Vercel can't run Django, so the API lives on Render. |

---

## 4. Backend structure (`backend/`)

```
config/            Django project (settings, urls, wsgi)
api/
  views.py         create_trip / get_trip / health / geocode_suggest
  serializers.py   TripInputSerializer + output serializers
  models.py        Trip, Stop, LogDay
  services/ors.py  OpenRouteService client (geocode, route, autocomplete)
hos/               PURE engine (no Django)
  rules.py         FMCSA constants
  types.py         Segment, Stop, DayLog, Violation, TripPlan dataclasses
  engine.py        build_timeline(...) + split_into_days(...)
tests/             pytest: HOS unit tests + API + ORS (mocked) + models
```

### Endpoints
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/health/` | liveness check |
| GET | `/api/geocode/?q=` | city autocomplete (proxies ORS) |
| POST | `/api/trips/` | plan a trip → route + stops + days + violations |
| GET | `/api/trips/<id>/` | reload a saved trip |

### Data model
- **Trip** — locations, `cycle_used_hrs`, totals, `route_geometry` (JSON), `violations` (JSON), `created_at`
- **Stop** — `trip` FK, `type` (pickup/dropoff/fuel/rest/break), `label`, `mile_marker`, `lat`, `lng`, `arrival`, `departure`
- **LogDay** — `trip` FK, `date`, `segments` (JSON), `totals` (JSON), `driving_miles`

### create_trip flow
1. Validate input (`TripInputSerializer`; cycle 0–70).
2. Resolve each location: use the picked place's coords if sent, else geocode.
3. `ors.route([current, pickup, dropoff])` → distance, duration, geometry, legs.
4. Downsample geometry to ≤ 800 points (keeps payload ~24 KB, map snappy).
5. `build_timeline(...)` with `pickup_offset_miles` = first leg distance.
6. `split_into_days(...)` → per-day logs (24h-padded).
7. Persist Trip + Stops (coords interpolated along geometry) + LogDays.
8. Return assembled JSON. ORS failures → **422** with a friendly message (not 500).

---

## 5. Frontend structure (`frontend/src/`)

```
lib/
  api.ts        createTrip / getTrip / suggestPlaces
  types.ts      shared types mirroring the API JSON
  theme.ts      dark/light store (localStorage + useSyncExternalStore)
  utils.ts      cn() class merge
components/
  ui/           button / card / input / label (shadcn-style, cva)
  TripForm.tsx       4 fields, selection-required validation
  CityAutocomplete.tsx  debounced search + popular-cities-on-focus
  RouteMap.tsx       Leaflet map, stops, animated truck playback
  EldLogSheet.tsx    DOT log: identification header + SVG grid (one per day)
  DaySelector.tsx    horizontal day picker (date over index) + All
  ViolationBanner.tsx
  TripDashboard.tsx  orchestrates the two sections
```

### Page layout (two sections)
1. **Route & Stops** — trip form (left, stretches to match) + stats + map (right).
2. **Daily Logs** — violation banner, day selector (1..N or All), then the
   selected day's full sheet (or all stacked). An off-screen full render is used
   so **PDF export always includes every day** regardless of selection.

### Key UX flows
- **Autocomplete:** focus shows popular cities; ≥2 chars → live ORS search;
  picking sends coordinates so the backend never re-geocodes free text.
- **Selection required:** typing without choosing a suggestion blocks submit with
  a clear message — prevents wrong/far geocodes (the source of giant-route errors).
- **Playback:** `requestAnimationFrame` advances progress 0→1 over ~14 s; truck
  interpolates along the geometry with a live driving clock + mileage.
- **Theme:** a tiny external store toggles a `light` class on `<html>`; map tiles
  and PDF background follow the theme.

---

## 6. Design decisions / trade-offs

- **Pure HOS engine, separate from Django** — the graded core is testable in
  isolation and has no framework coupling.
- **Coordinates required from search** — guarantees valid, intended locations and
  removes a whole class of routing failures.
- **Geometry downsampling (≤800 pts)** — cut a ~280 KB response to ~24 KB and made
  the map render fast, with negligible visual loss.
- **Day picker over a long scroll** — a 10–20 day trip would be an unusable wall of
  grids; the selector keeps Section 2 compact while All + PDF still expose
  everything.
- **34-hour restart instead of a dead error** — when the 70h cycle is exhausted the
  engine resolves it the way FMCSA allows, surfacing an informational note rather
  than failing the trip.
- **Off Duty for rest (no sleeper split)** — simpler and sufficient; the sleeper
  row is shown but zero.

---

## 7. Testing

- **HOS engine** — pytest unit tests per rule: single-day drive/break/fuel,
  multi-day 10h resets, 70h cycle → 34h restart, per-day split summing to 24h,
  pickup-after-first-leg.
- **API** — create/get happy path, validation 400, unroutable 422 (ORS mocked).
- **ORS client** — geocode/route parsing (HTTP mocked).
- **Frontend** — Vitest + Testing Library: API client, TripForm (pick-required),
  EldLogSheet render, RouteMap (react-leaflet mocked), TripDashboard end-to-end.

Run: `cd backend && pytest` · `cd frontend && npx vitest run`.

---

## 8. Configuration & secrets

Backend env (`backend/.env`): `DJANGO_SECRET_KEY`, `DJANGO_DEBUG`,
`DJANGO_ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`, `CSRF_TRUSTED_ORIGINS`,
`ORS_API_KEY` (server-side only). Frontend env (`frontend/.env`):
`VITE_API_BASE_URL`.

---

## 9. Deployment

- **Backend → Render** — `render.yaml` blueprint; `build.sh` runs
  `pip install` + `collectstatic` + `migrate`; served by `gunicorn` with
  WhiteNoise for static files. Set `ORS_API_KEY`, `CORS_ALLOWED_ORIGINS`
  (the Vercel URL), `DJANGO_DEBUG=False`.
- **Frontend → Vercel** — root dir `frontend`, Vite auto-detected,
  `VITE_API_BASE_URL` = the Render URL; `vercel.json` handles SPA routing.

---

## 10. Local development

```bash
# backend
cd backend && python3.12 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt && cp .env.example .env   # add ORS key
python manage.py migrate && python manage.py runserver 8000

# frontend
cd frontend && npm install && cp .env.example .env
npm run dev   # http://localhost:5173
```
