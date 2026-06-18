# ELD Trip Planner — Design

**Date:** 2026-06-18
**Status:** Approved

## Objective

Full-stack app that takes trip details as input and outputs (1) a map with the
route plus required stops/rests and (2) filled-out DOT daily log sheets. Built
for the Spotter AI full-stack assessment. Accuracy of the Hours-of-Service (HOS)
output and the quality of the UI/UX are both graded.

### Inputs
- Current location
- Pickup location
- Dropoff location
- Current cycle used (hours)

### Outputs
- Map showing route + information about stops and rests (free map API)
- Daily log sheets, drawn and filled out (multiple sheets for longer trips)

### Assumptions (from spec)
- Property-carrying driver, 70 hrs / 8 days, no adverse driving conditions
- Fueling at least once every 1,000 miles
- 1 hour for pickup and 1 hour for drop-off

## Tech Stack

| Layer | Choice | Host |
|-------|--------|------|
| Frontend | Vite + React + TypeScript + Tailwind + shadcn/ui | Vercel |
| Backend | Django + Django REST Framework + SQLite | Render |
| Map | Leaflet + OpenStreetMap tiles | — |
| Geocoding + Routing | OpenRouteService (free API key) | — |
| Log rendering | React SVG (interactive), export to PDF/PNG | — |

## Architecture

```
React SPA ──POST /api/trips──> Django DRF
  - TripForm                    - geocode 3 locations (ORS)
  - RouteMap (Leaflet)          - route legs: distance + duration (ORS)
  - EldLogSheet (SVG)           - HOS engine (pure module, unit-tested)
  - animated playback           - build stops + daily log segments
  - ViolationBanner             - persist Trip + Stops + LogDays (SQLite)
            <──trip JSON────     - return geometry + stops + logs + violations
```

Single primary endpoint plus retrieval:
- `POST /api/trips/` — create trip, run HOS engine, persist, return full result
- `GET /api/trips/<id>/` — re-load a saved trip (shareable URL)

## HOS Engine

Pure Python module under `backend/hos/`, no Django imports, fully unit-tested.
This is the graded accuracy core, so it is isolated and testable in isolation.

Full FMCSA property-carrying rules, 70 hr / 8 day cycle:
- **11-hour driving limit** — max 11 hours driving after 10 consecutive hours off
- **14-hour on-duty window** — no driving beyond the 14th hour after coming on duty
- **30-minute break** — required after 8 cumulative hours of driving
- **10-hour off-duty reset** — restarts the 11/14 clocks
- **70 hr / 8 day cycle** — seeded by the `current_cycle_used` input; trip cannot
  push cumulative on-duty over 70 in any rolling 8 days
- **1 hour pickup + 1 hour dropoff** — on-duty (not driving)
- **Fuel stop** — inserted at least every 1,000 miles (on-duty, not driving)

**Inputs:** total drive distance + duration per leg (from ORS), cycle hours used,
a trip start datetime (default: now).

**Output:** an ordered timeline of duty-status segments
`{status, start_dt, end_dt, location, note}` where status ∈
`{off_duty, sleeper, driving, on_duty}`. The timeline is then split at midnight
into calendar days; each day becomes one log sheet with per-status hour totals.

Violations (if any rule cannot be satisfied) are surfaced as structured warnings
with a human-readable message and a suggested fix.

## Data Model (SQLite)

- **Trip** — `current_location`, `pickup_location`, `dropoff_location`,
  `cycle_used_hrs`, geocoded coords, total distance/duration, `created_at`
- **Stop** — `trip` FK, `type` ∈ {pickup, dropoff, fuel, rest, break},
  `lat`, `lng`, `mile_marker`, `arrival`, `departure`, `label`
- **LogDay** — `trip` FK, `date`, `segments` (JSON: status/start/end/note),
  per-status totals (driving, on_duty, off_duty, sleeper)

## Frontend Components

- **TripForm** — four inputs with geocode autocomplete (ORS), validation
- **RouteMap** — Leaflet map, route polyline, typed stop markers + popups,
  animated "truck" playback along the route with a live HOS clock + current
  duty status
- **EldLogSheet** — SVG re-creation of the DOT grid: 24-hour timeline
  (midnight→midnight), four duty-status rows, the drawn duty-status line,
  right-side hour totals, remarks row; one sheet rendered per LogDay
- **ViolationBanner** — live HOS warnings with suggested fixes
- **TripDashboard** — orchestrates the above; dark mode + glassmorphism polish,
  fully responsive; PDF/PNG export of the log sheets

## Unique Differentiators

- Animated route playback with a live HOS clock and changing duty status
- Live HOS violation warnings with suggested fixes
- Export filled DOT log sheets to printable PDF / PNG
- Premium dark-mode dashboard (glassmorphism, smooth transitions, responsive)

## Testing

- **HOS engine** — unit tests covering each rule and boundary (the graded core):
  short trip (single day), multi-day trip, break insertion, fuel insertion,
  cycle-limit edge, 14-hour window cutoff
- **API** — DRF test for `POST /api/trips/` happy path + validation errors
- **Frontend** — component smoke tests for TripForm, EldLogSheet, RouteMap

## Repository Layout

```
/backend    Django project: api app, hos module, tests, requirements.txt
/frontend   Vite React app: components, lib (api client), styles
/docs       spec + setup/deploy notes
README.md   local run + deploy instructions, env vars, demo link
```

## Configuration / Secrets

- `ORS_API_KEY` — OpenRouteService key, backend env only (never shipped to client;
  the frontend calls Django, Django calls ORS). Geocode autocomplete proxied
  through a lightweight Django endpoint so the key stays server-side.
- `DJANGO_SECRET_KEY`, `DJANGO_ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS` — backend env
- `VITE_API_BASE_URL` — frontend env pointing at the Render backend

## Deliverables

- Live hosted version (Vercel frontend + Render backend)
- GitHub repository
- 3–5 minute Loom walking through the app and the code
