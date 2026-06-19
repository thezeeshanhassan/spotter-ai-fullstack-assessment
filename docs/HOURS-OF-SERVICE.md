# Hours of Service — Rules & How the Planner Works

This document explains the trucking **Hours of Service (HOS)** rules the app
enforces, how the engine turns a trip into compliant duty-status logs, how the
daily log sheets are produced, and a full worked example. It is the domain
reference for the project.

Source of truth: FMCSA *Interstate Truck Driver's Guide to Hours of Service for
Property Carriers* (49 CFR Part 395). The app models the **property-carrying,
70-hour / 8-day** schedule.

---

## 1. The problem

A driver enters a trip (current location, pickup, dropoff, and how many on-duty
hours they've already used in their cycle). The app must output:

1. A **route** with the stops and rests required to drive it legally.
2. **Daily log sheets** (the DOT "Record of Duty Status" grid), one per calendar
   day, filled in with the driver's duty status across 24 hours.

Driving is limited by federal fatigue rules, so a long trip cannot be driven
straight through — it must be broken up with breaks and rest periods, which is
exactly what the engine computes.

---

## 2. The four duty statuses

Every minute of a driver's day is exactly one of these (the four rows on the DOT
log grid):

| Status | Meaning |
|--------|---------|
| **Off Duty** | Not working, free of responsibility. |
| **Sleeper Berth** | Resting in the truck's sleeper. |
| **Driving** | At the controls of the moving CMV. |
| **On Duty (Not Driving)** | Working but not driving — loading, fueling, inspections, paperwork. |

This app logs rest as **Off Duty** (it does not model the sleeper-berth split),
so the Sleeper Berth row is always 0 — it's still shown because it's a required
field on the real DOT form.

---

## 3. The rules enforced

| Rule | Limit | Plain meaning | CFR |
|------|-------|---------------|-----|
| **11-hour driving limit** | 11 h | After 11 h of driving you must stop driving until a 10-hour reset. | §395.3(a)(3) |
| **14-hour window** | 14 h | No driving after the 14th hour following the start of your shift (on-duty time still allowed, just no driving). | §395.3(a)(2) |
| **30-minute break** | after 8 h | A ≥30-min break from driving is required once 8 cumulative driving hours pass. | §395.3(a)(3)(ii) |
| **10-hour reset** | 10 h | 10 consecutive hours off-duty restarts both the 11h and 14h clocks. | §395.3(a) |
| **70-hour / 8-day cycle** | 70 h | You cannot drive once total on-duty time over the rolling last 8 days hits 70 h. | §395.3(b) |
| **34-hour restart** | 34 h | 34+ consecutive hours off-duty resets the weekly cycle back to 0. | §395.3(c) |

### Assessment assumptions (baked in)
- Property-carrying driver, 70 h / 8 days, **no adverse-driving exception**.
- **No short-haul exceptions** (always full RODS logging).
- **Fuel at least every 1,000 miles** (on-duty, not driving).
- **1 hour for pickup and 1 hour for dropoff** (on-duty, not driving).
- Average speed for any distance↔time conversion fallback: **55 mph**.

### Constants (`backend/hos/rules.py`)
```
MAX_DRIVE_HOURS        = 11.0
MAX_DUTY_WINDOW_HOURS  = 14.0
BREAK_AFTER_DRIVE_HOURS = 8.0
BREAK_DURATION_HOURS   = 0.5
RESET_OFF_HOURS        = 10.0
CYCLE_LIMIT_HOURS      = 70.0
RESTART_OFF_HOURS      = 34.0
PICKUP_HOURS           = 1.0
DROPOFF_HOURS          = 1.0
FUEL_INTERVAL_MILES    = 1000.0
FUEL_DURATION_HOURS    = 0.5
AVG_SPEED_MPH          = 55.0
```

---

## 4. How the engine builds the timeline

`backend/hos/engine.py → build_timeline(...)` walks the route from the start time
mile by mile, keeping running counters: miles done, driving hours in the current
shift, driving since the last break, the 14-hour window start, and rolling cycle
hours (seeded with the driver's `current cycle used`).

On each loop it checks, in priority order, whether a stop must be inserted before
more driving:

1. **Cycle exhausted (≥70 h)?** → insert a **34-hour restart** (off-duty), reset
   the cycle to 0, reset the 11h/14h clocks, and record a `70h_cycle` violation
   note. (The trip stays legal — the restart resolves it.)
2. **11h driving or 14h window reached?** → insert a **10-hour reset** (off-duty)
   and restart the shift clocks.
3. **Pickup point reached?** → insert the **1-hour pickup** (on-duty). The pickup
   happens after driving the current→pickup leg, not at the origin.
4. **8h cumulative driving?** → insert a **30-minute break** (on-duty).
5. **1,000-mile mark?** → insert a **fuel stop** (on-duty).
6. Otherwise **drive** a chunk bounded by whichever limit comes first.

It ends with the **1-hour dropoff** (on-duty). Every inserted stop also produces a
map `Stop` (pickup/dropoff/fuel/rest/break) with a mile marker.

Distance↔time uses the route's own `duration / distance` ratio from
OpenRouteService, so timing reflects real road speeds.

---

## 5. From timeline to daily log sheets

`split_into_days(segments)`:
1. Cuts any duty segment that crosses **midnight** into two (driving miles on a cut
   segment are split in proportion to time).
2. Groups the pieces by **calendar date** — each date becomes one `DayLog` = one
   log sheet.
3. **Pads** the first/last partial days with Off Duty from/until midnight so every
   sheet totals exactly **24.00 hours** (a DOT requirement).
4. Computes per-status totals (Off / Sleeper / Driving / On-Duty) **and total
   driving miles** for the day.

The frontend draws each `DayLog` as a faithful DOT *Driver's Daily Log*:
- an **identification header** — date, **total miles driving today** (real),
  truck/trailer #, carrier, main office, co-driver, shipper/commodity, and the
  certification line (vehicle/carrier/shipper are placeholders, not modeled data);
- the **24-hour grid** — 24 hour columns with 15-minute ticks × 4 duty-status rows;
- the **duty-status line** with vertical connectors at each change;
- **per-status hour totals** down the right (summing to 24);
- a **remarks row** flagging only real duty-status changes (pickup, dropoff, fuel,
  30-min break, 10h/34h rest) with location/activity — not the continuous driving.

### How many days?
There is **no hardcoded minimum**. The number of sheets = the number of calendar
days the timeline spans. It depends on:
- **Start time** (currently `now()`), so a trip begun late simply crosses midnight.
- **Total duration** including all mandated rests.

A trip with > ~11 h of driving *must* contain at least one 10-hour reset
(11 h drive + 10 h off = 21 h), so it almost always lands on 2+ calendar days.
Short trips (under ~11 h driving, inside the 14h window, no reset) started early
fit in a single day.

### "Split shift" days are legal
The 11-hour limit is **per shift**, not per calendar day. A single calendar day
can legally contain two driving shifts separated by a 10-hour reset, so a day's
driving total can exceed 11 h. The UI flags such days **"Split shift"**
(informational), and **"Compliant"** otherwise — the engine never emits an actual
violation because it always inserts the required rest.

---

## 6. Worked example (real run)

**Inputs:** San Diego, CA → Vancouver, BC → Boston, MA · cycle used 0 h.

**Outputs:** 4,608 mi · 103.2 h driving · **10 log days** · `70h_cycle` →
34-hour restart inserted · stops: 1 pickup, 1 dropoff, 4 fuel, 9 breaks, 9 rests.

| Day | Date | Driving | On-Duty | Off-Duty | Sum |
|----:|------|--------:|--------:|---------:|----:|
| 1 | 2026-06-19 | 11.00 | 0.50 | 12.50 | 24.00 |
| 2 | 2026-06-20 | 11.00 | 0.50 | 12.50 | 24.00 |
| 3 | 2026-06-21 | 11.00 | 2.00 | 11.00 | 24.00 |
| 4 | 2026-06-22 | 11.07 | 0.50 | 12.43 | 24.00 |
| 5 | 2026-06-23 | 13.00 | 1.00 | 10.00 | 24.00 |
| 6 | 2026-06-24 |  8.93 | 0.50 | 14.57 | 24.00 |
| 7 | 2026-06-25 |  4.07 | 0.50 | 19.43 | 24.00 |
| 8 | 2026-06-26 | 13.50 | 0.50 | 10.00 | 24.00 |
| 9 | 2026-06-27 | 12.50 | 1.50 | 10.00 | 24.00 |
| 10 | 2026-06-28 |  7.16 | 1.00 | 15.84 | 24.00 |

Driving total = 103.2 h (matches the route). Around Days 6–7 the rolling on-duty
time hits 70 h, so a **34-hour restart** is inserted (note Day 7's 19.43 h off
flowing into Day 8). Days 5/8/9 show > 11 h driving — legal split-shift days.

Reproduce:
```bash
curl -s -X POST http://localhost:8000/api/trips/ -H "Content-Type: application/json" \
  -d '{"current_location":"San Diego, CA, USA","pickup_location":"Vancouver, BC, Canada","dropoff_location":"Boston, MA, USA","cycle_used_hrs":0}' | python3 -m json.tool
```

---

## 7. Limits & honest caveats

- **Sleeper-berth split** is not modeled — rest is logged as Off Duty.
- **Adverse-driving** and **short-haul** exceptions are intentionally out of scope
  (per the assessment assumptions).
- OpenRouteService caps a single route at **~6,000 km / ~3,700 mi** (ORS server
  limit). Longer paths return HTTP **422** with a “route too long” message — see
  `backend/api/views.py → _friendly_error()`.
- The 70h cycle is modeled as a running on-duty total seeded by the input rather
  than a literal day-by-day rolling 8-day array — sufficient for single-trip
  planning and matches the "can't drive past 70h" behavior.
