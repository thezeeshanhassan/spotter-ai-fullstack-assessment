# Loom Script — ELD Trip Planner (≈3 min)

Tips: speak in present tense ("here I…"), keep the cursor moving to what you mention,
have a multi-day trip ready (e.g. **Islamabad → Sitpur → Attock**, or for the US:
**New York → Atlanta → Miami**) so the logs look substantial. Links to keep open:
live app, GitHub repo, the `backend/hos/engine.py` file.

---

## 0:00 – 0:20 · Intro
> "Hi, this is my full-stack **ELD Trip Planner**, built with **Django REST Framework**
> on the backend and **React + TypeScript** on the front. You give it a trip — current
> location, pickup, dropoff, and hours already used in your cycle — and it returns a
> route map with all the required stops and **FMCSA-compliant daily log sheets**, drawn
> exactly like the DOT logbook. It's deployed live — frontend on Vercel, backend on AWS."

*(Show the live app, top of the page.)*

## 0:20 – 0:45 · Inputs + smart search
> "The location fields are a **live city search** — I type, it queries OpenRouteService
> through my backend, loads results, and I scroll for more. If I edit a picked value it
> re-searches, and unknown places show 'no results'. This guarantees we always send real,
> geocoded coordinates."

*(Type a city, pick from dropdown, do all three + cycle hours, click **Plan Trip & Draw Logs**.)*

## 0:45 – 1:20 · Route map + animated playback
> "Section one is the route. It draws the full path with **color-coded stops** — pickup,
> dropoff, fuel every 1,000 miles, 30-minute breaks, and 10-hour rest resets. Hit **play**
> and a truck drives the route with a **live driving clock and mileage**. The stats up top
> show total distance, drive time, and how many log days it took."

*(Hover a couple markers, press play, let it run a few seconds.)*

## 1:20 – 2:00 · Daily logs (the graded core)
> "Section two is the daily logs. This is a **24-hour DOT grid** with the four duty
> statuses, 15-minute increments, the duty-status line, **per-status totals that sum to
> 24 hours**, and remarks drawn as brackets at each change. There's one sheet per day —
> I can jump to any day or view **All**, and **export every day to PDF**. Up here it even
> flags HOS conditions — this trip exceeded the **70-hour/8-day** limit, so the engine
> automatically inserted a **34-hour restart** so the driver stays legal."

*(Click a day in the selector, show a sheet, point at totals + the violation banner,
click Export PDF.)*

## 2:00 – 2:40 · Code overview
> "On the code side, the **Hours-of-Service engine** is a pure, unit-tested Python module —
> no Django coupling — that enforces the 11-hour driving limit, 14-hour window, 30-minute
> break, 10-hour reset, the 70-hour cycle, fueling and pickup/dropoff. It builds one
> timeline then splits it into per-day sheets padded to 24 hours. The Django API geocodes
> and routes through OpenRouteService — the API key stays server-side — and persists trips
> in SQLite. The frontend is componentized: the form, the Leaflet map, and an **SVG that
> redraws the DOT log**. There are **24 tests** — 17 backend, 7 frontend — green."

*(Quickly show `backend/hos/engine.py`, then `frontend/src/components/EldLogSheet.tsx`,
then the tests folder.)*

## 2:40 – 3:00 · Deploy + close
> "It's deployed for real reliability — the backend runs in **Docker behind Caddy on AWS
> EC2 with automatic HTTPS**, so there are no cold starts, and the frontend is on Vercel.
> Dark and light themes, fully responsive. That's the ELD Trip Planner — thanks for
> watching."

*(Toggle dark/light once, end on the full dashboard.)*

---

## Quick-hit feature checklist (mention if time / for a 5-min cut)
- Live city autocomplete (search, scroll-to-load-more, no-results, re-search on edit)
- Free map API (Leaflet + OpenStreetMap) with animated truck playback + live clock
- Color-coded stops: pickup / dropoff / fuel / break / rest
- DOT-accurate daily log: 4 statuses, 15-min ticks, duty line, 24h totals, bracketed remarks
- Multiple sheets for long trips; day selector + "All"; per-day total driving miles
- Full FMCSA rule set incl. 70h cycle → auto 34-hour restart with a clear warning
- PDF export of all sheets; dark/light theme; responsive glassmorphism UI
- Pure unit-tested HOS engine; 24 automated tests
- Production deploy: AWS EC2 + Docker + Caddy (HTTPS, always-on) and Vercel
