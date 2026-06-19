# Worked Example — Coast-to-coast trip (full scenario walkthrough)

This document traces one real trip end-to-end: every input, every step the system
takes, every HOS rule that fires, and how the 10 daily log sheets are produced.
All numbers below come from an actual run against the API (not estimates).

---

## 1. Inputs

| Field | Value |
|-------|-------|
| Current location | San Diego, CA, USA |
| Pickup location | Vancouver, BC, Canada |
| Dropoff location | Boston, MA, USA |
| Current cycle used | 0 hrs |

This is a deliberately extreme trip (US west coast → Canada → US east coast) to
exercise **every** part of the planner: multi-day driving, the 14h/11h limits,
30-minute breaks, fuel stops, 10-hour resets, and the 70-hour cycle limit with a
34-hour restart.

## 2. Output summary

| Metric | Value |
|--------|-------|
| Total distance | **4,608 mi** |
| Total driving time | **103.2 h** |
| Log days (sheets) | **10** |
| Violations | `70h_cycle` → **34-hour restart inserted** |
| Stops | 1 pickup · 1 dropoff · 4 fuel · 9 breaks · 9 rests (10h resets + the 34h restart) |

---

## 3. How the result is produced (pipeline)

```
Frontend (TripForm)                Backend (Django)                 OpenRouteService
──────────────────                ────────────────                 ────────────────
pick 3 cities + coords ──POST──▶  /api/trips/
                                    1. resolve 3 locations  ───────▶ (coords used; geocode if absent)
                                    2. route the 3 points   ───────▶ /v2/directions/driving-hgv
                                       ◀── distance, duration, geometry, per-leg distances
                                    3. HOS engine: build_timeline(...)
                                    4. split_into_days(...)  → 10 DayLogs
                                    5. persist Trip + Stops + LogDays (SQLite)
            ◀──── JSON: route + stops + days + violations ────
render: map + playback + 10 SVG log sheets
```

Code map:
- `backend/api/views.py` → `create_trip` (orchestration)
- `backend/api/services/ors.py` → `geocode` / `route`
- `backend/hos/engine.py` → `build_timeline`, `split_into_days`
- `frontend/src/components/{RouteMap,EldLogSheet,DaySelector,TripDashboard}.tsx`

The trip start time is `timezone.now()` (UTC). Distance comes back at 4,608 mi and
driving time at 103.2 h; everything else is derived by the HOS engine.

---

## 4. HOS rules applied (49 CFR §395, property-carrying)

The engine walks the route mile-by-mile and inserts duty-status segments as each
limit is hit:

| Rule | Constant | What the engine does |
|------|----------|----------------------|
| **11-hour driving limit** | `MAX_DRIVE_HOURS = 11` | Stops driving at 11h within a shift; inserts a 10h reset to continue. |
| **14-hour window** | `MAX_DUTY_WINDOW_HOURS = 14` | No driving past the 14th hour after going on duty. |
| **30-minute break** | after `BREAK_AFTER_DRIVE_HOURS = 8` | Inserts a 0.5h on-duty break after 8h cumulative driving (9 in this trip). |
| **10-hour reset** | `RESET_OFF_HOURS = 10` | Off-duty block that restarts the 11h/14h clocks (the bulk of the "rest" stops). |
| **70-hour / 8-day cycle** | `CYCLE_LIMIT_HOURS = 70` | Tracks rolling on-duty hours; when exhausted, inserts a 34h restart. |
| **34-hour restart** | `RESTART_OFF_HOURS = 34` | Resets the weekly cycle to 0 so the driver can legally finish. |
| **Fueling** | `FUEL_INTERVAL_MILES = 1000` | On-duty fuel stop every 1,000 mi → 4 stops over 4,608 mi. |
| **Pickup / dropoff** | `PICKUP/DROPOFF_HOURS = 1` | 1h on-duty (not driving) at the pickup point and the dropoff. |

The pickup happens **after** driving the current→pickup leg (San Diego→Vancouver),
not at the origin — the engine uses the first leg's distance as the pickup offset.

---

## 5. Day-by-day breakdown (actual totals)

Each sheet is one calendar day, midnight→midnight, padded with Off Duty so it
totals exactly 24.00 h.

| Day | Date | Driving | On-Duty | Off-Duty | Sum | Note |
|----:|------|--------:|--------:|---------:|----:|------|
| 1 | 2026-06-19 | 11.00 | 0.50 | 12.50 | 24.00 | full 11h shift |
| 2 | 2026-06-20 | 11.00 | 0.50 | 12.50 | 24.00 | full 11h shift |
| 3 | 2026-06-21 | 11.00 | 2.00 | 11.00 | 24.00 | pickup (1h) lands here |
| 4 | 2026-06-22 | 11.07 | 0.50 | 12.43 | 24.00 | two shifts spanning midnight |
| 5 | 2026-06-23 | 13.00 | 1.00 | 10.00 | 24.00 | **split shift** (2 shifts in one day) |
| 6 | 2026-06-24 |  8.93 | 0.50 | 14.57 | 24.00 | shift ends; long rest |
| 7 | 2026-06-25 |  4.07 | 0.50 | 19.43 | 24.00 | **34h restart begins** (70h cycle hit) |
| 8 | 2026-06-26 | 13.50 | 0.50 | 10.00 | 24.00 | restart done; driving resumes |
| 9 | 2026-06-27 | 12.50 | 1.50 | 10.00 | 24.00 | split shift |
| 10 | 2026-06-28 |  7.16 | 1.00 | 15.84 | 24.00 | arrival + dropoff (1h) |

Driving total = **103.2 h** (matches the route duration). Days where driving > 11h
(5, 8, 9) are **legal**: they contain two driving shifts separated by a 10-hour
reset within the same calendar day — the 11h limit is per-shift, not per-day.

---

## 6. The 70-hour limit and the 34-hour restart

By around Day 6–7 the driver's rolling on-duty time reaches the **70-hour / 8-day**
cap. A driver may not drive again until they drop below 70h. The engine handles
this exactly as FMCSA allows: it inserts a **34-hour restart** (a single off-duty
block ≥34h), which resets the weekly cycle to zero. That restart spans Day 7 into
Day 8 (note Day 7's 19.43h off-duty and Day 8 starting with 10.00h off then a full
driving shift).

This is surfaced to the user as an informational banner:

> ⚠️ Trip exceeds the 70-hour/8-day on-duty limit. Inserted a 34-hour restart so
> the driver can legally continue.

It is **not** a hard error — the plan remains fully compliant.

---

## 7. Why 10 days

The day count is not fixed; it's the number of calendar days the timeline spans.
Here, 103.2h of driving must be broken by:
- eight **10-hour resets** (one per ~11h driving shift), plus
- one **34-hour restart** (70h cycle),

so total elapsed time ≈ 103h driving + ~9 rests + breaks/fuel/pickup/dropoff
≈ 9+ days of wall-clock time, landing on **10 calendar dates**. See
[daily-log-days-explained.md](daily-log-days-explained.md) for the general rule.

---

## 8. Map & stops

The route map shows the full San Diego → Vancouver → Boston polyline with
color-coded markers:
- 🟢 pickup, 🔴 dropoff, 🟠 fuel (×4), 🟣 rest (10h resets + 34h restart), 🔵 break (×9)

Playback animates a truck from the current location along the route with a live
driving clock and mileage counter (4,608 mi).

---

## 9. Reproduce it

```bash
curl -s -X POST http://localhost:8000/api/trips/ \
  -H "Content-Type: application/json" \
  -d '{"current_location":"San Diego, CA, USA",
       "pickup_location":"Vancouver, BC, Canada",
       "dropoff_location":"Boston, MA, USA",
       "cycle_used_hrs":0}' | python3 -m json.tool
```

Or in the UI: pick the three cities from the search dropdowns and click
**Plan Trip & Draw Logs**. Use the day selector (1–10 or **All**) to inspect each
sheet, and **Export PDF** to download all 10.
