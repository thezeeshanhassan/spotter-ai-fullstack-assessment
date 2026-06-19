# Design & Implementation

Single source of truth for how the ELD Trip Planner is built, configured, tested,
and deployed.

For FMCSA domain rules (Hours of Service), see [HOURS-OF-SERVICE.md](HOURS-OF-SERVICE.md).
For the Loom walkthrough script, see [LOOM-SCRIPT.md](LOOM-SCRIPT.md).

**Live deployment**

| Service | URL |
|---------|-----|
| Frontend (Vercel) | https://spotter-ai-fullstack-assessment.vercel.app |
| Backend API (AWS EC2) | https://16.170.244.106.nip.io |

---

## 1. Goal

Take trip details (current / pickup / dropoff location + optional cycle hours) and
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
                                                  │
                                    AWS EC2 · Docker · Caddy (HTTPS)
```

- The frontend never talks to OpenRouteService directly — the **API key stays
  server-side**; the backend proxies geocoding, routing, and autocomplete.
- The **HOS engine is a pure Python module** (no Django imports) so the graded
  accuracy logic is isolated and unit-tested on its own.
- Production backend runs **always-on** on EC2 in Docker. **Caddy** terminates
  HTTPS (Let's Encrypt) and reverse-proxies to **Gunicorn**.

> **Why HTTPS is mandatory:** Vercel serves the frontend over HTTPS. Browsers block
> an HTTPS page from calling a plain HTTP API ("mixed content"). The backend must
> be HTTPS — Caddy + a hostname (domain or nip.io) provide that.

---

## 3. Tech stack & why

| Layer | Choice | Reason |
|-------|--------|--------|
| Frontend | Vite + React + TypeScript | Fast dev, typed, SPA fits a single planning screen. |
| Styling | Tailwind + shadcn-style primitives | Rapid, consistent, dark/light theming via CSS vars. |
| Map | Leaflet + OpenStreetMap (Carto tiles) | Free tile sets; light/dark variants. |
| Geocode + routing | OpenRouteService | Free API; geometry, per-leg distances, autocomplete. |
| Backend | Django + Django REST Framework | Serializers, validation, admin if needed. |
| DB | SQLite | Zero-config persistence; trips are reloadable by ID. |
| Logs export | jsPDF + html2canvas | Client-side multi-page PDF of the SVG sheets. |
| Hosting | Vercel (FE) + AWS EC2 (BE) | Vercel for the SPA; Django in Docker on EC2 (no cold starts). |

**Repo layout**

```
backend/           Django project, HOS engine, pytest suite
frontend/          Vite React app
docs/              DESIGN.md (this file), HOURS-OF-SERVICE.md, LOOM-SCRIPT.md
docker-compose.yml Production backend stack (backend + Caddy)
Caddyfile          HTTPS hostname + reverse proxy config
```

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
Dockerfile         Production image (collectstatic + gunicorn)
```

### Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/health/` | Liveness check → `{"status":"ok"}` |
| GET | `/api/geocode/?q=` | City autocomplete (proxies ORS) |
| POST | `/api/trips/` | Plan a trip → route + stops + days + violations |
| GET | `/api/trips/<id>/` | Reload a saved trip |

### Data model

- **Trip** — locations, `cycle_used_hrs`, totals, `route_geometry` (JSON), `violations` (JSON), `created_at`
- **Stop** — `trip` FK, `type` (pickup/dropoff/fuel/rest/break), `label`, `mile_marker`, `lat`, `lng`, `arrival`, `departure`
- **LogDay** — `trip` FK, `date`, `segments` (JSON), `totals` (JSON), `driving_miles`

### create_trip flow

1. Validate input (`TripInputSerializer`; cycle 0–70, optional — defaults to 0).
2. Resolve each location: use picked-place coordinates from the frontend if sent, else geocode.
3. `ors.route([current, pickup, dropoff])` → distance, duration, geometry, legs.
4. Downsample geometry to ≤ 800 points (keeps payload ~24 KB, map snappy).
5. `build_timeline(...)` with `pickup_offset_miles` = first leg distance.
6. `split_into_days(...)` → per-day logs (24 h padded).
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
  TripForm.tsx       locations (required) + optional cycle; submit gating
  CityAutocomplete.tsx  debounced search + popular-cities-on-focus
  RouteMap.tsx       Leaflet map, stops, animated truck playback
  EldLogSheet.tsx    DOT log: identification header + SVG grid (one per day)
  DaySelector.tsx    horizontal day picker (date over index) + All
  ViolationBanner.tsx
  TripDashboard.tsx  orchestrates the two sections
  AboutPage.tsx      rules, policies, limitations (/about)
  DeveloperPage.tsx  author intro & links (/developer)
  AppLayout.tsx      shared header, nav, theme toggle
vercel.json     SPA routing for Vercel
```

### Page layout (two sections)

1. **Route & Stops** — trip form (left, stretches to match) + stats + map (right).
2. **Daily Logs** — violation banner, day selector (1..N or All), then the
   selected day's full sheet (or all stacked). An off-screen full render is used
   so **PDF export always includes every day** regardless of selection.

### Key UX flows

- **Autocomplete:** focus shows popular cities; ≥2 chars → live ORS search via
  the backend; picking sends coordinates so the backend never re-geocodes free text.
- **Required locations:** current, pickup, and dropoff show a red `*`; **Plan Trip**
  stays disabled until all three are chosen from the dropdown (not just typed).
- **Optional cycle:** cycle used defaults to **0** if left empty; if entered, must
  be 0–70 (hours already on duty in the 70 h / 8-day window).
- **Playback:** `requestAnimationFrame` advances progress 0→1 over ~14 s; truck
  interpolates along the geometry with a live driving clock + mileage.
- **Theme:** a tiny external store toggles a `light` class on `<html>`; map tiles
  and PDF background follow the theme.

---

## 6. Design decisions / trade-offs

- **Pure HOS engine, separate from Django** — the graded core is testable in
  isolation and has no framework coupling.
- **Coordinates required from search** — guarantees valid locations and removes
  wrong-geocode / giant-route failures.
- **Geometry downsampling (≤800 pts)** — cut a ~280 KB response to ~24 KB with
  negligible visual loss.
- **Day picker over a long scroll** — a 10–20 day trip would be an unusable wall
  of grids; the selector keeps Section 2 compact while All + PDF expose everything.
- **34-hour restart instead of a dead error** — when the 70 h cycle is exhausted
  the engine inserts the FMCSA-allowed restart and shows an informational warning.
- **Off Duty for rest (no sleeper split)** — simpler and sufficient; the sleeper
  row is shown but zero.
- **AWS EC2 over serverless backend** — always-on API, no cold-start delay on
  first trip plan after idle.

### Route length cap (OpenRouteService)

OpenRouteService enforces a **~6,000 km (~3,700 mile)** limit on a single routing
request (server configuration). When a current → pickup → dropoff path exceeds
that approximation, ORS returns an error and the API responds with **422** and a
friendly message:

> *This route is too long to plan (over ~3,700 miles / 6,000 km). Pick locations that are closer together.*

This is **not** an app bug — it is an upstream routing limit. In practice:

| Typical outcome | Distance |
|-----------------|----------|
| Most US trips | Well under the cap |
| Long hauls that work | ~4,300–4,600 mi (e.g. San Diego → Vancouver → Boston) |
| Ultra-long zigzags | Often fail (e.g. coast-to-coast-to-coast in one request) |

The About page (`/about`) documents this for users alongside other limitations.

---

## 7. Testing

- **HOS engine** — pytest per rule: single-day drive/break/fuel, multi-day 10 h
  resets, 70 h cycle → 34 h restart, per-day split summing to 24 h, pickup-after-first-leg.
- **API** — create/get happy path, validation 400, unroutable 422 (ORS mocked).
- **ORS client** — geocode/route parsing (HTTP mocked).
- **Frontend** — Vitest + Testing Library: API client, TripForm (required picks,
  optional cycle), EldLogSheet render, RouteMap (react-leaflet mocked), TripDashboard.

Run:

```bash
cd backend && pytest          # 17 tests
cd frontend && npx vitest run # 7 tests
```

---

## 8. Configuration & secrets

### Backend (`backend/.env`)

| Variable | Local example | Production example |
|----------|---------------|-------------------|
| `DJANGO_SECRET_KEY` | any dev string | long random string |
| `DJANGO_DEBUG` | `True` | `False` |
| `DJANGO_ALLOWED_HOSTS` | `*` or `localhost` | `16.170.244.106.nip.io` or `api.yourdomain.com` |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:5173` | `https://spotter-ai-fullstack-assessment.vercel.app` |
| `CSRF_TRUSTED_ORIGINS` | (optional locally) | Vercel URL + backend URL |
| `ORS_API_KEY` | your key | your key ([free signup](https://openrouteservice.org/dev/#/signup)) |

Copy locally: `cp backend/.env.example backend/.env`

### Frontend (`frontend/.env`)

| Variable | Local | Production (Vercel) |
|----------|-------|---------------------|
| `VITE_API_BASE_URL` | `http://localhost:8000` | `https://16.170.244.106.nip.io` |

Copy locally: `cp frontend/.env.example frontend/.env`

---

## 9. Deployment

Production stack: **Vercel (frontend)** + **AWS EC2 (backend in Docker + Caddy)**.

### 9.1 Backend — AWS EC2 + Docker + Caddy

**What you need**

- AWS account (EC2 `t3.micro` / `t2.micro` — free tier eligible).
- A hostname pointing at the server:
  - **Own domain:** `api.yourdomain.com` → A record → EC2 public IP, or
  - **No domain:** [nip.io](https://nip.io) with the EC2 IP, e.g. `16.170.244.106.nip.io`
    (resolves automatically; Caddy gets a real Let's Encrypt cert).
- OpenRouteService API key.

**1. Launch EC2**

1. EC2 → Launch instance → **Ubuntu 24.04 LTS**, type **t3.micro**.
2. Create/download a key pair (SSH).
3. **Security group** inbound:
   - SSH **22** (your IP only)
   - HTTP **80** (0.0.0.0/0) — Let's Encrypt challenge
   - HTTPS **443** (0.0.0.0/0)
4. Note the **public IPv4 address**.

**2. Point hostname at the server**

- Domain: A record `api.yourdomain.com → <EC2 IP>`
- nip.io: use `<EC2-IP>.nip.io` in `Caddyfile` (no DNS setup)

Verify: `ping 16.170.244.106.nip.io` (or your domain).

**3. Install Docker on the instance**

```bash
ssh -i your-key.pem ubuntu@<EC2_IP>
sudo apt-get update
sudo apt-get install -y docker.io docker-compose-v2 git
sudo usermod -aG docker ubuntu && newgrp docker
```

**4. Clone and configure**

```bash
git clone https://github.com/thezeeshanhassan/spotter-ai-fullstack-assessment.git
cd spotter-ai-fullstack-assessment
nano backend/.env
nano Caddyfile
```

`backend/.env` (production):

```env
DJANGO_SECRET_KEY=<long random string>
DJANGO_DEBUG=False
DJANGO_ALLOWED_HOSTS=16.170.244.106.nip.io
CORS_ALLOWED_ORIGINS=https://spotter-ai-fullstack-assessment.vercel.app
CSRF_TRUSTED_ORIGINS=https://spotter-ai-fullstack-assessment.vercel.app,https://16.170.244.106.nip.io
ORS_API_KEY=<your OpenRouteService key>
```

Generate a secret key:

```bash
python3 -c "import secrets; print(secrets.token_urlsafe(50))"
```

`Caddyfile` (match `DJANGO_ALLOWED_HOSTS`):

```
16.170.244.106.nip.io {
	encode gzip
	reverse_proxy backend:8000
}
```

**5. Build and run**

```bash
docker compose up -d --build
docker compose logs -f caddy   # watch certificate issuance; Ctrl+C when done
curl https://16.170.244.106.nip.io/api/health/
# → {"status":"ok"}
```

SQLite lives in the `dbdata` Docker volume and **persists** across restarts.
Migrations run automatically on container start.

**6. Update backend later**

```bash
cd ~/spotter-ai-fullstack-assessment
git pull
docker compose up -d --build
```

**Useful commands**

```bash
docker compose ps
docker compose logs -f backend
docker compose restart backend
docker compose up -d --force-recreate backend   # after .env change
docker compose down                             # stop; volume/data kept
```

**No-domain alternatives**

- **DuckDNS (free):** register `something.duckdns.org`, point IP to EC2, use in
  `Caddyfile` + `DJANGO_ALLOWED_HOSTS`.
- **Cloudflare Tunnel:** expose backend over HTTPS without opening 80/443; point
  Vercel at the tunnel URL and drop Caddy.

---

### 9.2 Frontend — Vercel

**1. Import project**

1. [vercel.com](https://vercel.com) → **Add New → Project**.
2. Import the GitHub repo.

**2. Build settings**

| Setting | Value |
|---------|-------|
| **Root Directory** | `frontend` |
| Framework Preset | Vite (auto-detected) |
| Build Command | `npm run build` |
| Output Directory | `dist` |

**3. Environment variable**

Project → Settings → Environment Variables (all environments):

```
VITE_API_BASE_URL = https://16.170.244.106.nip.io
```

**4. Deploy**

Click **Deploy** → you get a URL like `https://spotter-ai-fullstack-assessment.vercel.app`.

**5. CORS on the backend (required)**

After you know the Vercel URL, whitelist it on EC2:

```bash
ssh -i your-key.pem ubuntu@<EC2_IP>
cd ~/spotter-ai-fullstack-assessment
nano backend/.env
```

```env
CORS_ALLOWED_ORIGINS=https://spotter-ai-fullstack-assessment.vercel.app
CSRF_TRUSTED_ORIGINS=https://spotter-ai-fullstack-assessment.vercel.app,https://16.170.244.106.nip.io
```

Apply:

```bash
docker compose up -d --force-recreate backend
```

> Without CORS, the browser shows a CORS error and trip planning fails. Add every
> Vercel URL you use (production + preview domains if testing previews).

**6. Verify end-to-end**

1. Open the Vercel URL.
2. Pick three cities from the dropdown, click **Plan Trip & Draw Logs**.
3. DevTools → Network: `POST /api/trips/` → **201** against the backend HTTPS URL.

**Redeploys**

- **Frontend:** push to the default branch → Vercel auto-deploys. Changing
  `VITE_API_BASE_URL` requires a redeploy.
- **Backend:** `git pull && docker compose up -d --build` on EC2.

**Custom domains (optional)**

- **Frontend:** add domain in Vercel project settings.
- **Backend:** A record → EC2 IP, update `Caddyfile` + `DJANGO_ALLOWED_HOSTS`,
  then `docker compose up -d --build`.

---

## 10. Local development

```bash
# Backend
cd backend
python3.12 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # add ORS_API_KEY
python manage.py migrate
python manage.py runserver    # http://localhost:8000
pytest

# Frontend (separate terminal)
cd frontend
npm install
cp .env.example .env          # VITE_API_BASE_URL=http://localhost:8000
npm run dev                   # http://localhost:5173
npx vitest run
```

Do **not** use `runserver` in production — use Docker + Gunicorn on EC2.
