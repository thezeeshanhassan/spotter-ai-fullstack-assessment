# ELD Trip Planner

Full-stack app that turns trip details into a **route map with required stops/rests**
and **filled-out FMCSA daily log sheets (ELD)**. Built for the Spotter AI full-stack
assessment.

> **Inputs:** current location · pickup location · dropoff location · current cycle used (hrs)
> **Outputs:** an interactive route map (stops, rests, fuel) + one drawn DOT daily log sheet per day.

- **Live demo:** _TODO — add Vercel URL after deploy_
- **API:** _TODO — add Render URL after deploy_
- **Loom walkthrough:** _TODO — add Loom link_

---

## Tech stack

| Layer | Stack |
|-------|-------|
| Frontend | Vite + React + TypeScript + Tailwind + shadcn-style UI → Vercel |
| Backend | Django 5.2 + Django REST Framework + SQLite → Render |
| Map | Leaflet + OpenStreetMap (Carto dark tiles) |
| Geocoding + routing | OpenRouteService (free API key, backend-only) |
| Logs | React SVG (interactive), PDF export via jsPDF + html2canvas |

## Features

- FMCSA property-carrying **Hours-of-Service engine** (pure, unit-tested): 11h driving
  limit, 14h window, 30-min break after 8h, 10h reset, 70h/8-day cycle, auto **34-hour
  restart**, 1h pickup/dropoff, fuel every 1,000 mi.
- **Animated route playback** — a truck drives the route with a live driving clock + miles.
- **Live HOS violation warnings** with suggested fixes.
- **Drawn DOT log sheets**, one per day, with duty-status line, per-status totals, remarks.
- **Export to PDF.** Dark glassmorphism UI, fully responsive.

## Project layout

```
backend/    Django: config/ (project), api/ (DRF + ORS client), hos/ (pure HOS engine), tests/
frontend/   Vite React app: components/, lib/ (api + types), ui/ primitives
docs/       design spec + implementation plan (docs/superpowers/)
render.yaml Render blueprint for the backend
PROGRESS.md per-task build log
```

## Local setup

### Backend

```bash
cd backend
python3.12 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # then put your ORS key in .env
python manage.py migrate
python manage.py runserver    # http://localhost:8000
pytest                        # run the test suite
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env          # VITE_API_BASE_URL=http://localhost:8000
npm run dev                   # http://localhost:5173
npm run test                  # vitest
npm run build                 # production build
```

## Environment variables

**Backend (`backend/.env`)**

| Var | Purpose |
|-----|---------|
| `DJANGO_SECRET_KEY` | Django secret |
| `DJANGO_DEBUG` | `True` locally, `False` in prod |
| `DJANGO_ALLOWED_HOSTS` | comma-separated hosts (`.onrender.com`) |
| `CORS_ALLOWED_ORIGINS` | frontend origin(s), e.g. your Vercel URL |
| `CSRF_TRUSTED_ORIGINS` | https origins for admin (optional) |
| `ORS_API_KEY` | OpenRouteService key ([free signup](https://openrouteservice.org/dev/#/signup)) |

**Frontend (`frontend/.env`)**

| Var | Purpose |
|-----|---------|
| `VITE_API_BASE_URL` | backend base URL (Render URL in prod) |

## API

| Method | Path | Body / result |
|--------|------|---------------|
| `GET` | `/api/health/` | `{"status":"ok"}` |
| `POST` | `/api/trips/` | `{current_location, pickup_location, dropoff_location, cycle_used_hrs}` → `{id, route, stops, days, violations}` |
| `GET` | `/api/trips/<id>/` | same shape (reloads a saved trip) |

## Deployment

**Backend → Render**

1. New **Web Service** from this repo (or use `render.yaml` as a Blueprint).
2. Root dir `backend`, build `./build.sh`, start `gunicorn config.wsgi:application`.
3. Set env vars: `ORS_API_KEY`, `CORS_ALLOWED_ORIGINS` (your Vercel URL),
   `CSRF_TRUSTED_ORIGINS`. `DJANGO_DEBUG=False`, `DJANGO_ALLOWED_HOSTS=.onrender.com`.

**Frontend → Vercel**

1. Import the repo, set **root directory** to `frontend` (framework auto-detected: Vite).
2. Env var `VITE_API_BASE_URL` = your Render backend URL.
3. Deploy. `vercel.json` handles SPA routing.

## HOS rules

The HOS engine implements the FMCSA *Interstate Truck Driver's Guide to Hours of Service*
for property carriers (70hr/8day). Assumptions per the brief: no adverse-driving or
short-haul exceptions, fuel at least every 1,000 miles, 1h pickup + 1h dropoff.

```
backend/hos/rules.py     constants
backend/hos/engine.py    build_timeline() + split_into_days()
backend/tests/           per-rule unit tests
```
