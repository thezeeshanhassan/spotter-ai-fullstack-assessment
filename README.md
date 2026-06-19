# ELD Trip Planner

Full-stack app that turns trip details into a **route map with required stops/rests**
and **filled-out FMCSA daily log sheets (ELD)**. Built for the Spotter AI full-stack
assessment.

> **Inputs:** current location · pickup location · dropoff location · cycle used (optional, hrs)
> **Outputs:** an interactive route map (stops, rests, fuel) + one drawn DOT daily log sheet per day.

- **Live demo:** https://spotter-ai-fullstack-assessment.vercel.app
- **API:** https://16.170.244.106.nip.io
- **Loom walkthrough:** _add Loom link_

Full design, architecture, and deployment guide: **[docs/DESIGN.md](docs/DESIGN.md)**

---

## Tech stack

| Layer | Stack |
|-------|-------|
| Frontend | Vite + React + TypeScript + Tailwind + shadcn-style UI → **Vercel** |
| Backend | Django 5.2 + Django REST Framework + SQLite → **AWS EC2** (Docker + Caddy) |
| Map | Leaflet + OpenStreetMap (Carto tiles) |
| Geocoding + routing | OpenRouteService (free API key, backend-only) |
| Logs | React SVG (interactive), PDF export via jsPDF + html2canvas |

## Features

- FMCSA property-carrying **Hours-of-Service engine** (pure, unit-tested): 11 h driving
  limit, 14 h window, 30-min break after 8 h, 10 h reset, 70 h/8-day cycle, auto **34-hour
  restart**, 1 h pickup/dropoff, fuel every 1,000 mi.
- **Live city search** — pick locations from autocomplete (coordinates sent to backend).
- **Required location fields** (marked with `*`) — submit disabled until all three are picked.
- **Optional cycle used** — defaults to 0 (fresh driver).
- **Animated route playback** — truck drives the route with a live driving clock + miles.
- **Live HOS violation warnings** with suggested fixes.
- **Drawn DOT log sheets**, one per day, with duty-status line, per-status totals, remarks.
- **Export to PDF.** Dark/light theme, fully responsive.
- **About page** (`/about`) — HOS rules, policies, and limitations (including route length cap).
- **Developer page** (`/developer`) — short author bio, email & repo links (edit `frontend/src/lib/developer.ts`).

## Project layout

```
backend/           Django: config/, api/, hos/ (pure HOS engine), tests/
frontend/          Vite React app: components/, lib/, ui/
docs/              DESIGN.md (architecture + deploy), HOURS-OF-SERVICE.md, 
docker-compose.yml Production backend (Gunicorn + Caddy on EC2)
Caddyfile          HTTPS hostname for the backend
```

## Quick start (local)

### Backend

```bash
cd backend
python3.12 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # add ORS_API_KEY (OpenRouteService)
python manage.py migrate
python manage.py runserver    # http://localhost:8000
pytest                        # 17 tests
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env          # VITE_API_BASE_URL=http://localhost:8000
npm run dev                   # http://localhost:5173
npx vitest run                # 7 tests
npm run build                 # production build
```

## Environment variables

See **[docs/DESIGN.md §8](docs/DESIGN.md#8-configuration--secrets)** for full details.

**Backend (`backend/.env`):** `DJANGO_SECRET_KEY`, `DJANGO_DEBUG`, `DJANGO_ALLOWED_HOSTS`,
`CORS_ALLOWED_ORIGINS`, `CSRF_TRUSTED_ORIGINS`, `ORS_API_KEY`

**Frontend (`frontend/.env`):** `VITE_API_BASE_URL`

## API

| Method | Path | Body / result |
|--------|------|---------------|
| `GET` | `/api/health/` | `{"status":"ok"}` |
| `GET` | `/api/geocode/?q=` | City autocomplete (proxies OpenRouteService) |
| `POST` | `/api/trips/` | `{current_location, pickup_location, dropoff_location, cycle_used_hrs?, lat/lng…}` → `{id, route, stops, days, violations}` |
| `GET` | `/api/trips/<id>/` | Same shape (reloads a saved trip) |

## Deployment

Production: **Vercel** (frontend) + **AWS EC2** (backend in Docker behind Caddy with automatic HTTPS). No cold starts.

Step-by-step instructions: **[docs/DESIGN.md §9](docs/DESIGN.md#9-deployment)**

## HOS rules

The HOS engine implements the FMCSA *Interstate Truck Driver's Guide to Hours of Service*
for property carriers (70 hr / 8 day). Domain reference: **[docs/HOURS-OF-SERVICE.md](docs/HOURS-OF-SERVICE.md)**

```
backend/hos/rules.py     constants
backend/hos/engine.py    build_timeline() + split_into_days()
backend/tests/           per-rule unit tests
```
