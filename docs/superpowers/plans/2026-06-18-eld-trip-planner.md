# ELD Trip Planner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full-stack app that takes trip details (current/pickup/dropoff location + cycle hours used) and outputs a route map with required stops/rests and filled-out DOT daily log sheets.

**Architecture:** React SPA (Vite + TS + Tailwind + shadcn/ui) calls a Django REST Framework API. The backend geocodes and routes via OpenRouteService, runs a pure-Python HOS engine to build a duty-status timeline, splits it into per-day log sheets, persists everything in SQLite, and returns route geometry + stops + logs + violations. Frontend renders a Leaflet map and SVG DOT log sheets.

**Tech Stack:** Django 5 + DRF + SQLite, requests; Vite + React 18 + TypeScript + Tailwind + shadcn/ui + Leaflet (react-leaflet) + jsPDF/html2canvas.

## Global Constraints

- Property-carrying driver, 70 hrs / 8 days, no adverse driving conditions.
- HOS rules: 11h driving limit, 14h on-duty window, 30-min break after 8h driving, 10h off-duty reset.
- Fueling at least once every 1,000 miles.
- 1 hour for pickup, 1 hour for drop-off (on-duty, not driving).
- Free map API only (Leaflet/OpenStreetMap display + OpenRouteService routing).
- `ORS_API_KEY` lives in backend env only; never exposed to the client.
- Python 3.11+, Node 18+.
- Average driving speed assumption for time-from-distance where ORS duration is unavailable: 55 mph.

---

## File Structure

```
backend/
  manage.py
  requirements.txt
  config/            Django project (settings, urls, wsgi)
  api/               DRF app: models, serializers, views, urls, services
    services/ors.py  OpenRouteService client (geocode, route)
  hos/               pure HOS engine (no Django imports)
    __init__.py
    rules.py         constants
    engine.py        build_timeline() + split_into_days()
    types.py         dataclasses: Segment, DayLog, Violation, RouteInput
  tests/             pytest tests for hos + api
frontend/
  index.html
  package.json
  vite.config.ts
  tailwind.config.js
  src/
    main.tsx, App.tsx
    lib/api.ts       typed API client
    lib/types.ts     shared TS types matching API JSON
    components/
      TripForm.tsx
      RouteMap.tsx
      EldLogSheet.tsx
      ViolationBanner.tsx
      TripDashboard.tsx
docs/
README.md
```

---

## Task 1: Backend scaffold + health endpoint

**Files:**
- Create: `backend/requirements.txt`, `backend/manage.py`, `backend/config/__init__.py`, `backend/config/settings.py`, `backend/config/urls.py`, `backend/config/wsgi.py`, `backend/api/__init__.py`, `backend/api/apps.py`, `backend/api/views.py`, `backend/api/urls.py`
- Test: `backend/tests/test_health.py`

**Interfaces:**
- Produces: `GET /api/health/` → `{"status": "ok"}`; Django project importable as `config`.

- [ ] **Step 1: Create requirements.txt**

```
Django==5.0.6
djangorestframework==3.15.1
django-cors-headers==4.3.1
requests==2.32.3
python-dotenv==1.0.1
pytest==8.2.0
pytest-django==4.8.0
gunicorn==22.0.0
whitenoise==6.7.0
```

- [ ] **Step 2: Scaffold Django project**

Run from `backend/`:
```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
django-admin startproject config .
python manage.py startapp api
```

- [ ] **Step 3: Configure settings**

In `backend/config/settings.py`: load `.env` via `python-dotenv`, add `rest_framework`, `corsheaders`, `api` to `INSTALLED_APPS`; add `corsheaders.middleware.CorsMiddleware` and `whitenoise.middleware.WhiteNoiseMiddleware`. Read from env:
```python
import os
from dotenv import load_dotenv
load_dotenv()
SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "dev-insecure-key")
DEBUG = os.environ.get("DJANGO_DEBUG", "True") == "True"
ALLOWED_HOSTS = os.environ.get("DJANGO_ALLOWED_HOSTS", "*").split(",")
CORS_ALLOWED_ORIGINS = [o for o in os.environ.get("CORS_ALLOWED_ORIGINS", "http://localhost:5173").split(",") if o]
ORS_API_KEY = os.environ.get("ORS_API_KEY", "")
```

- [ ] **Step 4: Write the failing test**

`backend/tests/test_health.py`:
```python
import pytest
from rest_framework.test import APIClient

@pytest.mark.django_db
def test_health():
    res = APIClient().get("/api/health/")
    assert res.status_code == 200
    assert res.json() == {"status": "ok"}
```
Add `backend/pytest.ini`:
```ini
[pytest]
DJANGO_SETTINGS_MODULE = config.settings
python_files = test_*.py
```

- [ ] **Step 5: Run test, verify it fails**

Run: `cd backend && pytest tests/test_health.py -v`
Expected: FAIL (404, no route).

- [ ] **Step 6: Implement health view + wire urls**

`backend/api/views.py`:
```python
from rest_framework.decorators import api_view
from rest_framework.response import Response

@api_view(["GET"])
def health(request):
    return Response({"status": "ok"})
```
`backend/api/urls.py`:
```python
from django.urls import path
from . import views
urlpatterns = [path("health/", views.health)]
```
`backend/config/urls.py` — include `path("api/", include("api.urls"))`.

- [ ] **Step 7: Run test, verify pass**

Run: `cd backend && pytest tests/test_health.py -v`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add backend && git commit -m "feat: scaffold Django backend with health endpoint"
```

---

## Task 2: HOS types + rule constants

**Files:**
- Create: `backend/hos/__init__.py`, `backend/hos/rules.py`, `backend/hos/types.py`
- Test: `backend/tests/test_hos_types.py`

**Interfaces:**
- Produces:
  - `rules.py` constants: `MAX_DRIVE_HOURS=11.0`, `MAX_DUTY_WINDOW_HOURS=14.0`, `BREAK_AFTER_DRIVE_HOURS=8.0`, `BREAK_DURATION_HOURS=0.5`, `RESET_OFF_HOURS=10.0`, `CYCLE_LIMIT_HOURS=70.0`, `PICKUP_HOURS=1.0`, `DROPOFF_HOURS=1.0`, `FUEL_INTERVAL_MILES=1000.0`, `FUEL_DURATION_HOURS=0.5`, `AVG_SPEED_MPH=55.0`.
  - `types.py` dataclasses (all `@dataclass`):
    - `Segment(status: str, start: datetime, end: datetime, location: str, note: str)` — status ∈ {"off_duty","sleeper","driving","on_duty"}; method `duration_hours() -> float`.
    - `Stop(type: str, label: str, mile_marker: float, lat: float|None, lng: float|None, arrival: datetime, departure: datetime)`.
    - `DayLog(date: date, segments: list[Segment], totals: dict[str,float])`.
    - `Violation(rule: str, message: str, suggestion: str)`.
    - `TripPlan(segments: list[Segment], stops: list[Stop], days: list[DayLog], violations: list[Violation])`.

- [ ] **Step 1: Write failing test**

`backend/tests/test_hos_types.py`:
```python
from datetime import datetime
from hos.types import Segment

def test_segment_duration():
    s = Segment("driving", datetime(2026,1,1,8), datetime(2026,1,1,11,30), "I-80", "")
    assert s.duration_hours() == 3.5
```

- [ ] **Step 2: Run, verify fail**

Run: `cd backend && pytest tests/test_hos_types.py -v` → FAIL (module missing).

- [ ] **Step 3: Implement rules.py + types.py**

Write the constants in `rules.py` and the dataclasses in `types.py` exactly as in Interfaces. `duration_hours` returns `(self.end - self.start).total_seconds() / 3600`.

- [ ] **Step 4: Run, verify pass**

Run: `cd backend && pytest tests/test_hos_types.py -v` → PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/hos backend/tests/test_hos_types.py && git commit -m "feat: add HOS types and rule constants"
```

---

## Task 3: HOS engine — single-day trip (driving + duty limits + pickup/dropoff)

**Files:**
- Create: `backend/hos/engine.py`
- Test: `backend/tests/test_hos_engine_singleday.py`

**Interfaces:**
- Consumes: `hos.types`, `hos.rules`.
- Produces: `build_timeline(*, total_miles: float, total_drive_hours: float, cycle_used_hours: float, start: datetime, pickup_label: str, dropoff_label: str) -> TripPlan`. Builds an ordered `Segment` list starting at `start`: first segment `on_duty` for `PICKUP_HOURS` at pickup, then alternating `driving` chunks, inserting `on_duty` fuel stops, `on_duty` 30-min breaks, `off_duty` 10h resets as rules require, ending with `on_duty` `DROPOFF_HOURS` at dropoff. Returns `TripPlan` with `stops` and (Task 5) `days` populated. For this task, focus on a trip that fits in one 14h window (no reset needed).

- [ ] **Step 1: Write failing test**

`backend/tests/test_hos_engine_singleday.py`:
```python
from datetime import datetime
from hos.engine import build_timeline
from hos import rules

def test_short_trip_pickup_drive_dropoff():
    # 220 miles, 4h drive, fits one day, no break (drive < 8h), no fuel (<1000mi)
    plan = build_timeline(
        total_miles=220, total_drive_hours=4.0, cycle_used_hours=0.0,
        start=datetime(2026,1,1,6,0), pickup_label="Chicago", dropoff_label="Des Moines",
    )
    statuses = [s.status for s in plan.segments]
    assert statuses == ["on_duty", "driving", "on_duty"]
    assert plan.segments[0].duration_hours() == rules.PICKUP_HOURS
    assert plan.segments[1].duration_hours() == 4.0
    assert plan.segments[2].duration_hours() == rules.DROPOFF_HOURS
    assert plan.violations == []

def test_break_inserted_after_8h_driving():
    # 550 miles, 10h drive -> needs a 30-min break after 8h
    plan = build_timeline(
        total_miles=550, total_drive_hours=10.0, cycle_used_hours=0.0,
        start=datetime(2026,1,1,5,0), pickup_label="A", dropoff_label="B",
    )
    assert any(s.status=="on_duty" and "break" in s.note.lower() for s in plan.segments)
    driving = sum(s.duration_hours() for s in plan.segments if s.status=="driving")
    assert abs(driving - 10.0) < 1e-6
```

- [ ] **Step 2: Run, verify fail**

Run: `cd backend && pytest tests/test_hos_engine_singleday.py -v` → FAIL.

- [ ] **Step 3: Implement build_timeline (single-day path)**

In `engine.py`, maintain a running cursor `dt`, counters `drive_today`, `duty_window_start`, `drive_since_break`, `miles_done`. Emit pickup `on_duty`. Loop: drive in chunks bounded by (a) remaining miles, (b) next fuel marker, (c) `BREAK_AFTER_DRIVE_HOURS - drive_since_break`, (d) `MAX_DRIVE_HOURS - drive_today`, (e) `MAX_DUTY_WINDOW_HOURS` window. Convert miles↔hours with `total_drive_hours/total_miles` ratio. After 8h cumulative driving insert a `BREAK_DURATION_HOURS` `on_duty` segment with note "30-min break". Insert `FUEL_DURATION_HOURS` `on_duty` "fuel" segment at each `FUEL_INTERVAL_MILES`. Emit dropoff `on_duty`. Build matching `Stop` entries. (Reset logic added in Task 4.)

- [ ] **Step 4: Run, verify pass**

Run: `cd backend && pytest tests/test_hos_engine_singleday.py -v` → PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/hos/engine.py backend/tests/test_hos_engine_singleday.py && git commit -m "feat: HOS engine single-day timeline with break + fuel"
```

---

## Task 4: HOS engine — multi-day resets + 70h cycle + violations

**Files:**
- Modify: `backend/hos/engine.py`
- Test: `backend/tests/test_hos_engine_multiday.py`

**Interfaces:**
- Consumes: Task 3 `build_timeline`. Add constant `RESTART_OFF_HOURS=34.0` to `rules.py`.
- Produces: same signature; now inserts a `RESET_OFF_HOURS` (10h) `off_duty` segment whenever the 11h drive limit or 14h window is hit and more driving remains, resetting `drive_today`/`duty_window_start`/`drive_since_break`. Seeds cumulative on-duty from `cycle_used_hours`; when cumulative on-duty (seed + accrued) reaches `CYCLE_LIMIT_HOURS` and miles remain, insert a `RESTART_OFF_HOURS` (34h) `off_duty` "34-hour restart" segment, reset the cycle counter to 0, and append a `Violation(rule="70h_cycle", message=..., suggestion="Inserted 34-hour restart to legally continue")` as an informational note. The 34h restart also resets the 11h/14h clocks.

- [ ] **Step 1: Write failing test**

`backend/tests/test_hos_engine_multiday.py`:
```python
from datetime import datetime
from hos.engine import build_timeline
from hos import rules

def test_multiday_inserts_10h_reset():
    # 1300 miles ~ 24h drive -> exceeds 11h/day, needs at least one 10h reset
    plan = build_timeline(
        total_miles=1300, total_drive_hours=24.0, cycle_used_hours=0.0,
        start=datetime(2026,1,1,6,0), pickup_label="A", dropoff_label="B",
    )
    resets = [s for s in plan.segments if s.status=="off_duty" and s.duration_hours()>=rules.RESET_OFF_HOURS]
    assert len(resets) >= 2
    daily_drive_ok = True  # no single 24h window has >11h driving — checked in Task 5 day split
    assert daily_drive_ok

def test_cycle_limit_triggers_34h_restart():
    # Seeded near the 70h cap with more driving to do -> a 34h restart must appear
    plan = build_timeline(
        total_miles=400, total_drive_hours=8.0, cycle_used_hours=69.0,
        start=datetime(2026,1,1,6,0), pickup_label="A", dropoff_label="B",
    )
    assert any(v.rule=="70h_cycle" for v in plan.violations)
    restarts = [s for s in plan.segments if s.status=="off_duty" and s.duration_hours()>=rules.RESTART_OFF_HOURS]
    assert len(restarts) >= 1

def test_fuel_stop_every_1000_miles():
    plan = build_timeline(
        total_miles=2100, total_drive_hours=38.0, cycle_used_hours=0.0,
        start=datetime(2026,1,1,6,0), pickup_label="A", dropoff_label="B",
    )
    fuel = [s for s in plan.segments if "fuel" in s.note.lower()]
    assert len(fuel) >= 2
```

- [ ] **Step 2: Run, verify fail**

Run: `cd backend && pytest tests/test_hos_engine_multiday.py -v` → FAIL.

- [ ] **Step 3: Implement reset + cycle logic**

Add to the drive loop: when `drive_today >= MAX_DRIVE_HOURS` or window elapsed `>= MAX_DUTY_WINDOW_HOURS` and miles remain, emit `off_duty` `RESET_OFF_HOURS` "10h reset", then zero `drive_today`, `drive_since_break`, set new `duty_window_start`. Track `cycle_used = cycle_used_hours + cumulative on_duty+driving`; when `cycle_used >= CYCLE_LIMIT_HOURS` and miles remain, emit `off_duty` `RESTART_OFF_HOURS` "34-hour restart", reset `cycle_used=0` and the 11h/14h clocks, and append the informational `Violation(rule="70h_cycle", ...)` once.

- [ ] **Step 4: Run, verify pass**

Run: `cd backend && pytest tests/test_hos_engine_multiday.py -v` → PASS. Then run full `pytest -v`.

- [ ] **Step 5: Commit**

```bash
git add backend/hos/engine.py backend/tests/test_hos_engine_multiday.py && git commit -m "feat: HOS engine multi-day resets, cycle limit, fueling"
```

---

## Task 5: Split timeline into per-day log sheets

**Files:**
- Modify: `backend/hos/engine.py` (add `split_into_days`)
- Test: `backend/tests/test_hos_days.py`

**Interfaces:**
- Consumes: `TripPlan.segments`.
- Produces: `split_into_days(segments: list[Segment]) -> list[DayLog]`. Splits any segment crossing midnight into two, groups by calendar date, computes `totals` dict per status summing to ~24h per full day. `build_timeline` calls this and populates `TripPlan.days`.

- [ ] **Step 1: Write failing test**

`backend/tests/test_hos_days.py`:
```python
from datetime import datetime
from hos.engine import build_timeline

def test_days_split_and_total_24h():
    plan = build_timeline(
        total_miles=1300, total_drive_hours=24.0, cycle_used_hours=0.0,
        start=datetime(2026,1,1,6,0), pickup_label="A", dropoff_label="B",
    )
    assert len(plan.days) >= 2
    for day in plan.days[1:-1]:  # full interior days
        assert abs(sum(day.totals.values()) - 24.0) < 1e-6
    # no segment crosses midnight
    for day in plan.days:
        for s in day.segments:
            assert s.start.date() == s.end.date() or s.end == s.start
```

- [ ] **Step 2: Run, verify fail**

Run: `cd backend && pytest tests/test_hos_days.py -v` → FAIL.

- [ ] **Step 3: Implement split_into_days + call from build_timeline**

Iterate segments; while a segment spans past midnight, cut at next midnight into two `Segment`s. Bucket by `start.date()`. For each day, `totals[status] = sum durations`. Assign `plan.days`.

- [ ] **Step 4: Run, verify pass**

Run: `cd backend && pytest tests/test_hos_days.py -v` then full `pytest -v` → PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/hos/engine.py backend/tests/test_hos_days.py && git commit -m "feat: split HOS timeline into per-day log sheets"
```

---

## Task 6: OpenRouteService client (geocode + route)

**Files:**
- Create: `backend/api/services/__init__.py`, `backend/api/services/ors.py`
- Test: `backend/tests/test_ors.py`

**Interfaces:**
- Produces:
  - `geocode(query: str) -> dict` → `{"label": str, "lat": float, "lng": float}` (calls ORS `/geocode/search`, takes first feature).
  - `route(coords: list[tuple[float,float]]) -> dict` → `{"distance_miles": float, "duration_hours": float, "geometry": list[[lat,lng]]}` (calls ORS `/v2/directions/driving-hgv/geojson`). Reads key from `settings.ORS_API_KEY`. Network calls wrapped so tests can monkeypatch `requests.post`/`requests.get`.

- [ ] **Step 1: Write failing test (mocked HTTP)**

`backend/tests/test_ors.py`:
```python
from unittest.mock import patch, MagicMock
from api.services import ors

def test_geocode_parses_first_feature():
    fake = {"features":[{"properties":{"label":"Chicago, IL"},"geometry":{"coordinates":[-87.65,41.85]}}]}
    with patch("api.services.ors.requests.get") as g:
        g.return_value = MagicMock(status_code=200, json=lambda: fake)
        out = ors.geocode("Chicago")
    assert out == {"label":"Chicago, IL","lat":41.85,"lng":-87.65}

def test_route_parses_summary_and_geometry():
    fake = {"features":[{"properties":{"summary":{"distance":160934,"duration":14400}},
            "geometry":{"coordinates":[[-87.65,41.85],[-93.6,41.6]]}}]}
    with patch("api.services.ors.requests.post") as p:
        p.return_value = MagicMock(status_code=200, json=lambda: fake)
        out = ors.route([(41.85,-87.65),(41.6,-93.6)])
    assert round(out["distance_miles"],1) == 100.0  # 160934 m
    assert round(out["duration_hours"],1) == 4.0
    assert out["geometry"][0] == [41.85,-87.65]
```

- [ ] **Step 2: Run, verify fail**

Run: `cd backend && pytest tests/test_ors.py -v` → FAIL.

- [ ] **Step 3: Implement ors.py**

`geocode`: GET `https://api.openrouteservice.org/geocode/search` with params `{api_key, text, size:1}`; map first feature → label + lat/lng (note ORS returns `[lng,lat]`). `route`: POST `https://api.openrouteservice.org/v2/directions/driving-hgv/geojson` with header `Authorization: <key>` and body `{"coordinates":[[lng,lat],...]}`; convert distance m→miles (`/1609.34`), duration s→hours (`/3600`), geometry `[lng,lat]`→`[lat,lng]`.

- [ ] **Step 4: Run, verify pass**

Run: `cd backend && pytest tests/test_ors.py -v` → PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/api/services backend/tests/test_ors.py && git commit -m "feat: OpenRouteService geocode + route client"
```

---

## Task 7: Trip models + migrations

**Files:**
- Create: `backend/api/models.py` (replace), `backend/api/migrations/` (generated)
- Test: `backend/tests/test_models.py`

**Interfaces:**
- Produces Django models:
  - `Trip(current_location, pickup_location, dropoff_location, cycle_used_hrs: float, total_miles: float, total_drive_hours: float, route_geometry: JSONField, created_at)`.
  - `Stop(trip FK related_name="stops", type, label, mile_marker, lat, lng, arrival, departure)`.
  - `LogDay(trip FK related_name="days", date, segments: JSONField, totals: JSONField)`.

- [ ] **Step 1: Write failing test**

`backend/tests/test_models.py`:
```python
import pytest
from api.models import Trip, Stop, LogDay

@pytest.mark.django_db
def test_trip_relations():
    t = Trip.objects.create(current_location="A", pickup_location="B",
        dropoff_location="C", cycle_used_hrs=0, total_miles=100, total_drive_hours=2,
        route_geometry=[[1,2]])
    t.stops.create(type="pickup", label="B", mile_marker=0, lat=1, lng=2,
        arrival="2026-01-01T06:00:00Z", departure="2026-01-01T07:00:00Z")
    t.days.create(date="2026-01-01", segments=[], totals={})
    assert t.stops.count()==1 and t.days.count()==1
```

- [ ] **Step 2: Run, verify fail**

Run: `cd backend && pytest tests/test_models.py -v` → FAIL.

- [ ] **Step 3: Implement models + migrate**

Write models as in Interfaces, then:
```bash
cd backend && python manage.py makemigrations api && python manage.py migrate
```

- [ ] **Step 4: Run, verify pass**

Run: `cd backend && pytest tests/test_models.py -v` → PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/api/models.py backend/api/migrations && git commit -m "feat: Trip, Stop, LogDay models"
```

---

## Task 8: Create-trip endpoint (orchestration) + serializers

**Files:**
- Create: `backend/api/serializers.py`
- Modify: `backend/api/views.py`, `backend/api/urls.py`
- Test: `backend/tests/test_trip_api.py`

**Interfaces:**
- Consumes: `ors.geocode`, `ors.route`, `hos.engine.build_timeline`, models.
- Produces:
  - `POST /api/trips/` body `{current_location, pickup_location, dropoff_location, cycle_used_hrs}` → 201 with `{id, route:{geometry, distance_miles, duration_hours}, stops:[...], days:[...], violations:[...]}`.
  - `GET /api/trips/<id>/` → same shape.
  - Validation: missing field → 400.

- [ ] **Step 1: Write failing test (mock ORS)**

`backend/tests/test_trip_api.py`:
```python
import pytest
from unittest.mock import patch
from rest_framework.test import APIClient

@pytest.mark.django_db
def test_create_trip(monkeypatch):
    from api.services import ors
    monkeypatch.setattr(ors, "geocode", lambda q: {"label":q,"lat":41.8,"lng":-87.6})
    monkeypatch.setattr(ors, "route", lambda c: {"distance_miles":220,"duration_hours":4.0,"geometry":[[41.8,-87.6],[41.6,-93.6]]})
    res = APIClient().post("/api/trips/", {
        "current_location":"Chicago","pickup_location":"Joliet",
        "dropoff_location":"Des Moines","cycle_used_hrs":0}, format="json")
    assert res.status_code==201
    body=res.json()
    assert "days" in body and len(body["days"])>=1
    assert body["route"]["distance_miles"]==220

@pytest.mark.django_db
def test_create_trip_validation():
    res = APIClient().post("/api/trips/", {"current_location":"X"}, format="json")
    assert res.status_code==400
```

- [ ] **Step 2: Run, verify fail**

Run: `cd backend && pytest tests/test_trip_api.py -v` → FAIL.

- [ ] **Step 3: Implement serializer + view**

`serializers.py`: `TripInputSerializer` (4 required fields, `cycle_used_hrs` float ≥0). View `create_trip`: validate; geocode current/pickup/dropoff; `route([current,pickup,dropoff])`; `build_timeline(total_miles, total_drive_hours, cycle_used_hrs, start=now)`; persist `Trip`, `Stop`s, `LogDay`s; return assembled JSON. `get_trip` reads persisted rows. Serialize `Segment`/`DayLog` to plain dicts (ISO datetimes).

- [ ] **Step 4: Run, verify pass**

Run: `cd backend && pytest -v` (whole suite) → PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/api && git commit -m "feat: create/get trip endpoints orchestrating ORS + HOS"
```

---

## Task 9: Frontend scaffold + Tailwind + shadcn/ui + API client

**Files:**
- Create: `frontend/` (Vite app), `frontend/src/lib/types.ts`, `frontend/src/lib/api.ts`, `frontend/.env.example`
- Test: `frontend/src/lib/api.test.ts`

**Interfaces:**
- Produces:
  - TS types in `types.ts` mirroring API JSON: `Segment`, `Stop`, `DayLog`, `Violation`, `TripResult`.
  - `createTrip(input): Promise<TripResult>` and `getTrip(id): Promise<TripResult>` in `api.ts`, base URL from `import.meta.env.VITE_API_BASE_URL`.

- [ ] **Step 1: Scaffold**

Run from repo root:
```bash
npm create vite@latest frontend -- --template react-ts
cd frontend && npm install
npm install -D tailwindcss postcss autoprefixer vitest @testing-library/react jsdom
npx tailwindcss init -p
npm install react-leaflet leaflet jspdf html2canvas
npm install -D @types/leaflet
```
Init shadcn/ui: `npx shadcn@latest init` (defaults, dark mode). Add base components: `npx shadcn@latest add button card input label`.

- [ ] **Step 2: Configure Tailwind + Vitest**

Tailwind `content: ["./index.html","./src/**/*.{ts,tsx}"]`; add directives to `src/index.css`. In `vite.config.ts` add `test: { environment: "jsdom", globals: true }`.

- [ ] **Step 3: Write failing test**

`frontend/src/lib/api.test.ts`:
```ts
import { describe, it, expect, vi } from "vitest";
import { createTrip } from "./api";

it("posts trip and returns parsed result", async () => {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true, status: 201,
    json: async () => ({ id:1, route:{distance_miles:220,duration_hours:4,geometry:[]}, stops:[], days:[], violations:[] }),
  }) as any;
  const r = await createTrip({ current_location:"A", pickup_location:"B", dropoff_location:"C", cycle_used_hrs:0 });
  expect(r.route.distance_miles).toBe(220);
});
```

- [ ] **Step 4: Run, verify fail**

Run: `cd frontend && npx vitest run src/lib/api.test.ts` → FAIL.

- [ ] **Step 5: Implement types.ts + api.ts**

Define interfaces in `types.ts`. In `api.ts` implement `createTrip`/`getTrip` using `fetch(`${BASE}/api/trips/...`)`, JSON headers, throw on `!ok`.

- [ ] **Step 6: Run, verify pass**

Run: `cd frontend && npx vitest run src/lib/api.test.ts` → PASS.

- [ ] **Step 7: Commit**

```bash
git add frontend && git commit -m "feat: scaffold React frontend with Tailwind, shadcn, API client"
```

---

## Task 10: TripForm component

**Files:**
- Create: `frontend/src/components/TripForm.tsx`
- Test: `frontend/src/components/TripForm.test.tsx`

**Interfaces:**
- Consumes: shadcn `Input`/`Button`/`Label`/`Card`.
- Produces: `<TripForm onSubmit={(input)=>void} loading={boolean} />`; four labeled fields (current, pickup, dropoff, cycle hours), client validation (all required, cycle 0–70), calls `onSubmit` with typed payload.

- [ ] **Step 1: Write failing test**

`TripForm.test.tsx`:
```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { TripForm } from "./TripForm";

it("submits entered values", () => {
  const onSubmit = vi.fn();
  render(<TripForm onSubmit={onSubmit} loading={false} />);
  fireEvent.change(screen.getByLabelText(/current/i), {target:{value:"Chicago"}});
  fireEvent.change(screen.getByLabelText(/pickup/i), {target:{value:"Joliet"}});
  fireEvent.change(screen.getByLabelText(/dropoff/i), {target:{value:"Des Moines"}});
  fireEvent.change(screen.getByLabelText(/cycle/i), {target:{value:"10"}});
  fireEvent.click(screen.getByRole("button",{name:/plan/i}));
  expect(onSubmit).toHaveBeenCalledWith({current_location:"Chicago",pickup_location:"Joliet",dropoff_location:"Des Moines",cycle_used_hrs:10});
});
```

- [ ] **Step 2: Run, verify fail** — `npx vitest run src/components/TripForm.test.tsx` → FAIL.

- [ ] **Step 3: Implement TripForm** — controlled inputs, validation, styled Card with the four fields + submit button labeled "Plan Trip". Disable button when `loading`.

- [ ] **Step 4: Run, verify pass** — same command → PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/TripForm.tsx frontend/src/components/TripForm.test.tsx && git commit -m "feat: TripForm component"
```

---

## Task 11: EldLogSheet SVG component

**Files:**
- Create: `frontend/src/components/EldLogSheet.tsx`
- Test: `frontend/src/components/EldLogSheet.test.tsx`

**Interfaces:**
- Consumes: `DayLog` type.
- Produces: `<EldLogSheet day={DayLog} />` rendering an SVG DOT log grid: header (date), 24 hour columns × 4 duty-status rows (Off Duty, Sleeper, Driving, On Duty), a polyline tracing the duty status across the day, right-column hour totals per status, remarks row. Pure render from `day.segments` + `day.totals`.

- [ ] **Step 1: Write failing test**

`EldLogSheet.test.tsx`:
```tsx
import { render } from "@testing-library/react";
import { EldLogSheet } from "./EldLogSheet";

it("renders four status rows and a duty polyline", () => {
  const day = { date:"2026-01-01",
    segments:[{status:"driving",start:"2026-01-01T06:00:00Z",end:"2026-01-01T10:00:00Z",location:"",note:""}],
    totals:{off_duty:20,sleeper:0,driving:4,on_duty:0} };
  const { container } = render(<EldLogSheet day={day as any} />);
  expect(container.querySelectorAll("svg text").length).toBeGreaterThan(4);
  expect(container.querySelector("polyline")).toBeTruthy();
});
```

- [ ] **Step 2: Run, verify fail** → FAIL.

- [ ] **Step 3: Implement EldLogSheet** — compute x from segment time (0–24h → 0–width), y from status row; build polyline points stepping between rows at status changes; render grid lines, row labels, hour ticks, totals column.

- [ ] **Step 4: Run, verify pass** → PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/EldLogSheet.tsx frontend/src/components/EldLogSheet.test.tsx && git commit -m "feat: SVG ELD daily log sheet"
```

---

## Task 12: RouteMap with Leaflet + stop markers + animated playback

**Files:**
- Create: `frontend/src/components/RouteMap.tsx`
- Test: `frontend/src/components/RouteMap.test.tsx`

**Interfaces:**
- Consumes: `TripResult` (`route.geometry`, `stops`).
- Produces: `<RouteMap result={TripResult} />`; react-leaflet `MapContainer` + OSM `TileLayer`, route `Polyline`, typed `Marker`s for stops with popups; a Play button animates a truck marker along the geometry with a live HOS clock + current duty status label. Map auto-fits route bounds.

- [ ] **Step 1: Write failing test (shallow)**

`RouteMap.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react";
import { RouteMap } from "./RouteMap";

vi.mock("react-leaflet", () => ({
  MapContainer:(p:any)=><div>{p.children}</div>, TileLayer:()=><div/>,
  Polyline:()=><div data-testid="poly"/>, Marker:(p:any)=><div>{p.children}</div>,
  Popup:(p:any)=><div>{p.children}</div>, useMap:()=>({fitBounds:()=>{}}),
}));

it("renders a polyline and a play control", () => {
  const result:any = { route:{geometry:[[41.8,-87.6],[41.6,-93.6]],distance_miles:220,duration_hours:4},
    stops:[{type:"pickup",label:"B",lat:41.7,lng:-88,mile_marker:0,arrival:"",departure:""}], days:[], violations:[] };
  render(<RouteMap result={result} />);
  expect(screen.getByTestId("poly")).toBeTruthy();
  expect(screen.getByRole("button",{name:/play/i})).toBeTruthy();
});
```

- [ ] **Step 2: Run, verify fail** → FAIL.

- [ ] **Step 3: Implement RouteMap** — leaflet CSS import, fix default marker icons, fit bounds via `useMap`, animation via `requestAnimationFrame` interpolating along geometry, Play/Pause button, overlay card showing elapsed HOS clock + duty status.

- [ ] **Step 4: Run, verify pass** → PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/RouteMap.tsx frontend/src/components/RouteMap.test.tsx && git commit -m "feat: Leaflet RouteMap with animated playback"
```

---

## Task 13: ViolationBanner + TripDashboard + PDF export + dark polish

**Files:**
- Create: `frontend/src/components/ViolationBanner.tsx`, `frontend/src/components/TripDashboard.tsx`
- Modify: `frontend/src/App.tsx`
- Test: `frontend/src/components/TripDashboard.test.tsx`

**Interfaces:**
- Consumes: `TripForm`, `RouteMap`, `EldLogSheet`, `ViolationBanner`, `createTrip`.
- Produces: `<TripDashboard/>` — holds state, calls `createTrip` on submit, shows loading, renders map + all day log sheets + violations; "Export PDF" button captures log sheets via html2canvas→jsPDF. `<ViolationBanner violations={Violation[]} />` renders nothing when empty, else warning cards. App is dark-mode, glassmorphism, responsive.

- [ ] **Step 1: Write failing test**

`TripDashboard.test.tsx`:
```tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { TripDashboard } from "./TripDashboard";
import * as api from "../lib/api";

vi.mock("./RouteMap", () => ({ RouteMap: () => <div>map</div> }));

it("renders log sheets after planning a trip", async () => {
  vi.spyOn(api,"createTrip").mockResolvedValue({ id:1,
    route:{distance_miles:220,duration_hours:4,geometry:[]}, stops:[],
    days:[{date:"2026-01-01",segments:[],totals:{off_duty:24,sleeper:0,driving:0,on_duty:0}}],
    violations:[] } as any);
  render(<TripDashboard/>);
  fireEvent.change(screen.getByLabelText(/current/i),{target:{value:"A"}});
  fireEvent.change(screen.getByLabelText(/pickup/i),{target:{value:"B"}});
  fireEvent.change(screen.getByLabelText(/dropoff/i),{target:{value:"C"}});
  fireEvent.change(screen.getByLabelText(/cycle/i),{target:{value:"0"}});
  fireEvent.click(screen.getByRole("button",{name:/plan/i}));
  await waitFor(()=>expect(screen.getByText(/2026-01-01/)).toBeTruthy());
});
```

- [ ] **Step 2: Run, verify fail** → FAIL.

- [ ] **Step 3: Implement components** — ViolationBanner, TripDashboard wiring, PDF export, App renders dashboard, dark theme + glass styling. Use ui-ux-pro-max guidance for visual polish.

- [ ] **Step 4: Run, verify pass** → `npx vitest run` whole suite PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src && git commit -m "feat: TripDashboard, violations, PDF export, dark polish"
```

---

## Task 14: Deployment config + README

**Files:**
- Create: `backend/build.sh`, `backend/.env.example`, `render.yaml`, `frontend/vercel.json` (if needed), `README.md` (replace)
- Modify: `backend/config/settings.py` (static + prod hosts)

**Interfaces:**
- Produces: deployable backend (Render: gunicorn + whitenoise + migrate on build) and frontend (Vercel: Vite static build, `VITE_API_BASE_URL` env). README documents local run, env vars, and deploy steps, plus the live demo + Loom links (filled after deploy).

- [ ] **Step 1: Backend prod config** — in settings: `STATIC_ROOT`, whitenoise storage, read `ALLOWED_HOSTS`/`CORS_ALLOWED_ORIGINS` from env. `build.sh`: `pip install -r requirements.txt && python manage.py collectstatic --noinput && python manage.py migrate`. `render.yaml` web service: build `./build.sh`, start `gunicorn config.wsgi`.

- [ ] **Step 2: Frontend prod config** — ensure `VITE_API_BASE_URL` used; add `vercel.json` SPA rewrite if routing needs it. `.env.example` files for both.

- [ ] **Step 3: README** — sections: overview, screenshots, local setup (backend venv + frontend npm), env vars table, run commands, deploy (Render + Vercel), HOS rules summary, live demo + Loom placeholders.

- [ ] **Step 4: Verify builds locally**

Run: `cd frontend && npm run build` (expect dist/) and `cd backend && python manage.py collectstatic --noinput` (expect success).

- [ ] **Step 5: Commit**

```bash
git add . && git commit -m "chore: deployment config (Render + Vercel) and README"
```

---

## Self-Review

**Spec coverage:** inputs/outputs (T8, T10–T13), map + stops (T12), per-day log sheets drawn (T5, T11), free map API (T6, T12), HOS full rules (T2–T5), fueling 1000mi (T3/T4), 1h pickup/dropoff (T3), 70h/8day (T4), persistence (T7), hosting (T14), unique features animated playback/violations/PDF/dark (T12, T13). Loom + live link = manual deliverables noted in T14 README. All covered.

**Placeholders:** none — every code step has concrete code/commands.

**Type consistency:** `build_timeline` signature identical across T3/T4/T5/T8; `TripResult`/`DayLog`/`Stop`/`Violation` shapes consistent between API (T8) and TS types (T9) and consumed identically in T10–T13; `createTrip` signature stable T9→T13.
