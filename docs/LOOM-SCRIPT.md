# Loom Script — ELD Trip Planner (about 3 minutes)

Use this script when recording your Loom walkthrough. Speak in the present tense
("here I click…", "this shows…"). Move your cursor to whatever you are talking
about. Have a **multi-day trip** ready so the logs look impressive.

**Good demo trips:**
- Pakistan: **Islamabad → Sialkot → Karachi**
- United States: **New York → Atlanta → Miami** (about 4 log days)
- Long US trip: **San Diego → Vancouver → Boston** (about 10 log days, shows the
  70-hour warning)

**Tabs to open before you record:**
1. Your **live app** (Vercel URL)
2. Your **GitHub repo**
3. Code file: `backend/hos/engine.py`
4. Code file: `frontend/src/components/EldLogSheet.tsx`

---

## Glossary — what the abbreviations mean

Read this once before recording so you sound confident on camera.

| Term | Full name | Plain English |
|------|-----------|---------------|
| **ELD** | Electronic Logging Device | The digital system truck drivers use to record their work hours instead of paper logbooks. This app *simulates* what an ELD would produce. |
| **DOT** | Department of Transportation (U.S.) | The U.S. government agency that regulates trucking. The daily log sheets in this app are drawn to look like the **official DOT paper logbook** (also called a "Record of Duty Status"). *(Not "DTO" — that is a different thing in software.)* |
| **FMCSA** | Federal Motor Carrier Safety Administration | The part of the DOT that writes the **truck driver fatigue rules**. "FMCSA-compliant" means the app follows those federal rules. |
| **HOS** | Hours of Service | The **legal limits** on how long a truck driver can drive and work before they must rest. Example: max 11 hours of driving, then a 10-hour break. |
| **Cycle used** | 70-hour / 8-day cycle | How many **work hours the driver has already used** in their current 8-day work window (max 70 hours total). Enter `0` for a fresh driver. |
| **34-hour restart** | 34-hour off-duty restart | When a driver hits the 70-hour limit, federal rules require **34 consecutive hours off duty** before the weekly clock resets. The app inserts this automatically. |
| **API** | Application Programming Interface | How the frontend (React app) talks to the backend (Django server). |
| **DRF** | Django REST Framework | The Python library used to build the backend API. |
| **ORS** | OpenRouteService | A free map service used to **find cities** (geocoding) and **calculate driving routes**. The API key stays on the server, never in the browser. |
| **SVG** | Scalable Vector Graphics | How the daily log grid is **drawn on screen** — lines and shapes in code, not a static image. |
| **PDF** | Portable Document Format | The export format for printing or sharing the log sheets. |
| **HTTPS** | Secure HTTP | Encrypted web connection. Required so the Vercel frontend can call the backend safely. |
| **AWS EC2** | Amazon Web Services — Elastic Compute Cloud | A virtual server in the cloud where the backend runs. |
| **Docker** | Container platform | Packages the backend so it runs the same way on the server as on your laptop. |
| **Caddy** | Web server | Handles **HTTPS certificates** automatically and forwards traffic to Django. |
| **Vercel** | Frontend hosting | Where the React website is deployed. |
| **SQLite** | Lightweight database | Stores saved trips on the backend (simple file-based database). |

### The four "duty statuses" on every log sheet

Every minute of a driver's day is one of these four rows on the DOT grid:

| Status | Meaning |
|--------|---------|
| **Off Duty** | Not working — resting, eating, sleeping away from work duties. |
| **Sleeper Berth** | Resting in the truck's sleeping compartment. (This app logs rest as Off Duty.) |
| **Driving** | Actually driving the truck. |
| **On Duty (Not Driving)** | Working but not driving — loading, unloading, fueling, inspections. |

---

## 0:00 – 0:25 · Introduction

**What to show:** Live app homepage.

**Say this:**

> "Hi, this is my **ELD Trip Planner** — ELD stands for **Electronic Logging Device**,
> which is what truck drivers use to record their legal work hours.
>
> It's a full-stack web app: **Django REST Framework** on the backend and
> **React with TypeScript** on the frontend.
>
> You enter a trip — where the driver is now, where they pick up freight, where they
> drop off, and how many hours they've already worked this week — and the app returns
> a **route map** with all required stops and rest breaks, plus **daily log sheets**
> that look like the official **DOT** — Department of Transportation — paper logbook,
> following **FMCSA** federal trucking rules.
>
> It's deployed live: the website is on **Vercel** and the API is on **AWS**."

---

## 0:25 – 0:55 · Form inputs and city search

**What to show:** Type in the three location fields, pick cities from the dropdown,
enter cycle hours, click **Plan Trip & Draw Logs**.

**Say this:**

> "These three fields are a **live city search**. When I type, the frontend asks my
> Django backend, which calls **OpenRouteService** to find real cities. I pick one
> from the list so we always send valid map coordinates — not just free text.
>
> **Cycle used** means how many **on-duty hours the driver has already worked** in
> their current 8-day window. The law allows a maximum of **70 hours on duty in 8
> days**. I'll enter zero — meaning a fresh driver with the full 70 hours available.
>
> Now I click **Plan Trip & Draw Logs** and the backend calculates the route and
> builds the legal driving schedule."

**Demo values you can paste:**
| Field | Example |
|-------|---------|
| Current location | `New York, NY` |
| Pickup location | `Atlanta, GA` |
| Dropoff location | `Miami, FL` |
| Cycle used | `0` |

---

## 0:55 – 1:30 · Route map and animated playback

**What to show:** Route map, hover stop markers, press Play for a few seconds.

**Say this:**

> "The first section is the **route map**, built with **Leaflet** and free
> **OpenStreetMap** tiles.
>
> The line is the full driving path: current location, then pickup, then dropoff.
> The colored markers are **required stops** the engine inserted to keep the trip legal:
>
> - **Pickup** and **dropoff** — one hour each for loading and unloading
> - **Fuel stops** — at least every 1,000 miles
> - **30-minute breaks** — required after 8 hours of driving
> - **10-hour rest resets** — required after 11 hours of driving or a 14-hour work window
>
> When I press **Play**, a truck icon moves along the route and the **driving clock**
> and **mileage** update live. Up top you see total distance, total drive time, and
> how many **daily log days** this trip spans."

---

## 1:30 – 2:10 · Daily log sheets (the main feature)

**What to show:** Scroll to log sheets, click different days, point at the grid,
show the violation banner if present, click **Export PDF**.

**Say this:**

> "The second section is the **daily log sheets** — this is the core of the app.
>
> Each sheet is a **24-hour grid** copied from the real **DOT logbook**. It has four
> rows for the four **duty statuses**: Off Duty, Sleeper, Driving, and On Duty Not
> Driving. The horizontal line drawn across the grid shows exactly when the driver
> was in each status. The numbers on the right are **hour totals** — they always add
> up to 24 hours for a full day.
>
> Long trips cross midnight, so there is **one sheet per calendar day**. I can switch
> between days here, or view **All** at once, and **export everything to PDF** for
> printing.
>
> If the trip is long enough, you may see this red warning: the driver exceeded the
> **70-hour, 8-day on-duty limit**. That is a real **HOS** — Hours of Service — rule.
> The engine automatically added a **34-hour off-duty restart** so the schedule stays
> legal. That long rest also shows up as a stop on the map and as a big Off Duty block
> on the log."

---

## 2:10 – 2:45 · Code walkthrough

**What to show:** `backend/hos/engine.py`, then `frontend/src/components/EldLogSheet.tsx`,
then the `backend/tests/` folder.

**Say this:**

> "On the code side, the most important piece is the **Hours of Service engine** in
> `backend/hos/engine.py`. It's **pure Python** with no Django dependencies, so it's
> easy to unit test — and that's what gets graded for accuracy.
>
> It enforces every federal rule: the **11-hour driving limit**, the **14-hour work
> window**, the **30-minute break**, the **10-hour rest reset**, the **70-hour weekly
> cycle**, plus pickup, dropoff, and fuel stops. It builds one continuous timeline,
> then **splits it at midnight** into separate daily sheets, each padded to 24 hours.
>
> The Django API handles geocoding and routing through OpenRouteService — the API key
> never goes to the browser — and saves trips in **SQLite**.
>
> On the frontend, `EldLogSheet.tsx` is an **SVG** component that redraws the DOT
> grid from the segment data. There are **17 backend tests** covering every HOS rule,
> plus frontend tests for the main components — all passing."

---

## 2:45 – 3:00 · Deployment and closing

**What to show:** Toggle dark/light theme, end on the full dashboard.

**Say this:**

> "For deployment, the backend runs in **Docker** on an **AWS EC2** server, with
> **Caddy** providing automatic **HTTPS** — so there are no cold starts like on free
> serverless tiers. The React frontend is on **Vercel**.
>
> The UI supports **dark and light themes** and works on mobile. That's the ELD Trip
> Planner — thanks for watching."

---

## Feature checklist (use if you have extra time)

Mention any of these if your recording runs long:

- [ ] Live city search with dropdown (real geocoded places)
- [ ] Free map (Leaflet + OpenStreetMap) with animated truck playback
- [ ] Color-coded stops: pickup, dropoff, fuel, break, rest
- [ ] DOT-style daily log: 4 duty rows, duty-status line, 24-hour totals
- [ ] Multiple log sheets for multi-day trips; day selector + "All" view
- [ ] Per-day driving miles shown on each sheet
- [ ] Full FMCSA rule set including 70-hour cycle and auto 34-hour restart
- [ ] PDF export of all log sheets
- [ ] Dark / light theme; responsive layout
- [ ] Pure unit-tested HOS engine; automated tests on backend and frontend
- [ ] Production deploy: AWS EC2 + Docker + Caddy (HTTPS) and Vercel

---

## Recording tips

1. **Close extra tabs** — only show the app, GitHub, and one or two code files.
2. **Wait for the map to load** before talking over it.
3. **Use a trip that produces 2+ log days** so the logs look substantial.
4. **If the red HOS warning appears**, explain it calmly — it means the engine fixed
   the schedule, not that the app is broken.
5. **Speak slowly** — 3 minutes goes fast. You can cut the code section to 20 seconds
   if you are running over time.
