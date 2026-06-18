# Why a trip produces N daily log sheets (and why it's often ≥2)

**Short answer:** there is **no hardcoded minimum of 2 days**. The number of daily
log sheets equals the number of **calendar days the trip's timeline touches**
(midnight → midnight). That number falls out of three things:

1. **When the trip starts** — currently the current time (`timezone.now()`).
2. **Total trip duration** — driving time + pickup/dropoff + fuel + required rests.
3. **HOS rest rules** — which force long off-duty periods that stretch the timeline.

So a trip spans 2 days whenever its activity crosses one midnight — which is
common, not a rule.

---

## How the day count is computed

The HOS engine builds one continuous timeline of duty-status segments, then
splits it by calendar date.

- `backend/hos/engine.py` → `build_timeline(...)` produces the ordered segments
  (Off Duty / Driving / On Duty / Sleeper) starting at `start`.
- `split_into_days(segments)` cuts any segment that crosses midnight and groups
  the pieces by calendar date. Each calendar date = one `DayLog` = one log sheet.
- The trip start passed in `backend/api/views.py` is `timezone.now()` (UTC).

There is no `min(2, …)` or any forced count anywhere — the list length is simply
how many distinct dates the timeline covers.

```
# of log sheets = number of distinct calendar dates between
                  trip start and trip end (inclusive)
```

---

## Why it's *frequently* 2+ days

### Reason 1 — the trip starts "now", so it usually crosses a midnight
Because `start = now()`, a trip begun at, say, 18:00 that needs 9 hours of
activity ends at 03:00 the next calendar day → **2 sheets**, even though it's a
single short trip. Start it at 06:00 and the same trip finishes the same day →
**1 sheet**.

### Reason 2 — HOS rules inject long rests that stretch the clock
Federal property-carrying limits (49 CFR §395) the engine enforces:

| Rule | Effect on the timeline |
|------|------------------------|
| **11-hour driving limit** | After 11h of driving you must stop driving. |
| **14-hour window** | No driving past the 14th hour after coming on duty. |
| **10-hour reset** | To drive again you need **10 consecutive hours off** — a big block that almost always pushes the trip past midnight. |
| **30-min break** | Required after 8h cumulative driving. |
| **70h/8-day cycle** | If exhausted, a **34-hour restart** is inserted (spans ≥2 midnights by itself). |

Any trip whose driving exceeds ~11 hours **must** contain at least one 10-hour
off-duty reset. 11h driving + 10h rest = 21h, so that trip nearly always lands
on 2+ calendar days. Longer trips chain more resets → more days.

**Example (real):** New York → Atlanta → Miami ≈ 1,500 mi, ~37h driving. That
needs three 10-hour resets, so the timeline runs across **4 calendar days** →
4 log sheets. That's required by the rules, not an arbitrary minimum.

### Reason 3 — each sheet is padded to a full 24h
A DOT daily log must total 24 hours. `split_into_days` pads the first and last
(partial) days with **Off Duty** time from/until midnight so every sheet sums to
24h. This doesn't add days — it only fills the ones that exist — but it's why
even a partial day looks like a complete sheet.

---

## Is a 1-day trip possible?

Yes. A trip that:
- starts early enough in the day, and
- has total driving short enough to need **no 10-hour reset** (≈ under 11h
  driving and inside the 14h window),

fits in a single calendar day → **1 log sheet**.

Example: a ~4–5 hour drive started in the morning = 1 day.

---

## Is the 2-day behavior "asked for" by the assessment?

No. The assessment only requires *"multiple log sheets will be needed for longer
trips."* The engine satisfies that correctly: it produces exactly as many sheets
as the timeline spans. The frequent 2-day result is a natural consequence of
starting at the current time plus the mandatory rest periods — not a requirement
or a bug.

---

## Optional: make short trips deterministic

If you'd prefer short trips to consistently show as 1 day in demos, change the
trip start in `backend/api/views.py` from `timezone.now()` to a fixed clock time,
e.g. the next 06:00. That removes the "started late → crosses midnight" effect
while keeping all HOS rules intact. (Not currently done — `now()` is more
realistic.)
