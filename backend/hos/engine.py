"""HOS timeline engine. Pure Python — no Django imports.

Builds an ordered list of duty-status Segments from trip distance/duration and
the driver's current cycle usage, applying FMCSA property-carrying rules.
"""

from __future__ import annotations

from datetime import datetime, time, timedelta

from . import rules
from .types import DayLog, Segment, Stop, TripPlan, Violation

EPS = 1e-6


def split_into_days(segments: list[Segment]) -> list[DayLog]:
    """Split segments at midnight and group them into per-calendar-day DayLogs.

    Any segment spanning midnight is cut into two so no segment crosses a day
    boundary. Each DayLog carries per-status hour totals (which sum to ~24h for
    a full interior day).
    """
    days: dict = {}
    order: list = []

    def bucket(seg: Segment) -> None:
        key = seg.start.date()
        if key not in days:
            days[key] = DayLog(date=key, segments=[], totals={})
            order.append(key)
        days[key].segments.append(seg)

    for seg in segments:
        cur = seg
        # Cut wherever the segment extends strictly past the next midnight. A
        # segment ending exactly at midnight belongs wholly to its start day.
        while True:
            next_midnight = datetime.combine(
                cur.start.date() + timedelta(days=1), time.min, tzinfo=cur.start.tzinfo
            )
            if cur.end <= next_midnight:
                break
            head = Segment(cur.status, cur.start, next_midnight, cur.location, cur.note)
            bucket(head)
            cur = Segment(cur.status, next_midnight, cur.end, cur.location, cur.note)
        bucket(cur)

    for key in order:
        day = days[key]
        totals: dict[str, float] = {
            rules.OFF_DUTY: 0.0, rules.SLEEPER: 0.0,
            rules.DRIVING: 0.0, rules.ON_DUTY: 0.0,
        }
        for seg in day.segments:
            totals[seg.status] = totals.get(seg.status, 0.0) + seg.duration_hours()
        day.totals = totals

    return [days[key] for key in order]


class _Builder:
    """Mutable cursor that accumulates segments and stops as the trip is walked."""

    def __init__(self, start: datetime):
        self.dt = start
        self.segments: list[Segment] = []
        self.stops: list[Stop] = []

    def add(self, status: str, hours: float, location: str = "", note: str = "") -> Segment:
        seg = Segment(status, self.dt, self.dt + timedelta(hours=hours), location, note)
        self.segments.append(seg)
        self.dt = seg.end
        return seg

    def add_stop(self, type_: str, label: str, mile_marker: float, arrival: datetime,
                 departure: datetime) -> None:
        self.stops.append(Stop(type_, label, round(mile_marker, 1), None, None, arrival, departure))


def build_timeline(
    *,
    total_miles: float,
    total_drive_hours: float,
    cycle_used_hours: float,
    start: datetime,
    pickup_label: str,
    dropoff_label: str,
) -> TripPlan:
    """Build a full TripPlan (segments + stops) for a trip.

    Walks the trip applying every property-carrying limit at once:
      - pickup / dropoff = 1h on-duty (not driving) each
      - 30-min break after 8h cumulative driving
      - fuel stop every 1,000 miles
      - 10h off-duty reset when the 11h driving limit or 14h window is reached
      - 34h off-duty restart when the 70h/8day cycle is exhausted (records a
        Violation noting the inserted restart)
    """
    b = _Builder(start)
    violations: list[Violation] = []
    hours_per_mile = (total_drive_hours / total_miles) if total_miles > EPS else 0.0

    # Pickup (on duty, not driving) — also starts the 14h driving window.
    pickup_arr = b.dt
    b.add(rules.ON_DUTY, rules.PICKUP_HOURS, pickup_label, "Pickup")
    b.add_stop("pickup", pickup_label, 0.0, pickup_arr, b.dt)

    miles_remaining = total_miles
    miles_done = 0.0
    drive_today = 0.0          # driving hours in the current 14h window
    drive_since_break = 0.0    # driving hours since the last 30-min break
    window_start = start       # start of the current 14h driving window
    cycle_used = cycle_used_hours + rules.PICKUP_HOURS  # rolling on-duty total
    next_fuel_at = rules.FUEL_INTERVAL_MILES
    cycle_flagged = False

    while miles_remaining > EPS:
        # 70h/8day cycle exhausted -> 34h restart (checked first).
        if cycle_used >= rules.CYCLE_LIMIT_HOURS - EPS:
            rest_arr = b.dt
            b.add(rules.OFF_DUTY, rules.RESTART_OFF_HOURS, note="34-hour restart")
            b.add_stop("rest", "34-hour restart", miles_done, rest_arr, b.dt)
            cycle_used = 0.0
            drive_today = 0.0
            drive_since_break = 0.0
            window_start = b.dt
            if not cycle_flagged:
                violations.append(Violation(
                    rule="70h_cycle",
                    message="Trip exceeds the 70-hour/8-day on-duty limit.",
                    suggestion="Inserted a 34-hour restart so the driver can legally continue.",
                ))
                cycle_flagged = True
            continue

        # 11h driving limit or 14h window reached -> 10h off-duty reset.
        window_elapsed = (b.dt - window_start).total_seconds() / 3600
        if (drive_today >= rules.MAX_DRIVE_HOURS - EPS
                or window_elapsed >= rules.MAX_DUTY_WINDOW_HOURS - EPS):
            reset_arr = b.dt
            b.add(rules.OFF_DUTY, rules.RESET_OFF_HOURS, note="10-hour reset")
            b.add_stop("rest", "10-hour off-duty reset", miles_done, reset_arr, b.dt)
            drive_today = 0.0
            drive_since_break = 0.0
            window_start = b.dt
            continue

        # 30-min break required after 8h cumulative driving.
        if drive_since_break >= rules.BREAK_AFTER_DRIVE_HOURS - EPS:
            break_arr = b.dt
            b.add(rules.ON_DUTY, rules.BREAK_DURATION_HOURS, note="30-min break")
            b.add_stop("break", "30-min break", miles_done, break_arr, b.dt)
            cycle_used += rules.BREAK_DURATION_HOURS
            drive_since_break = 0.0
            continue

        # Fuel stop every 1,000 miles.
        if miles_done >= next_fuel_at - EPS:
            fuel_arr = b.dt
            b.add(rules.ON_DUTY, rules.FUEL_DURATION_HOURS, note="Fuel stop")
            b.add_stop("fuel", f"Fuel stop @ {round(miles_done)} mi", miles_done, fuel_arr, b.dt)
            cycle_used += rules.FUEL_DURATION_HOURS
            next_fuel_at += rules.FUEL_INTERVAL_MILES
            continue

        # Drive a chunk bounded by every upcoming limit (in miles).
        def to_miles(hours: float) -> float:
            return hours / hours_per_mile if hours_per_mile > EPS else miles_remaining

        window_elapsed = (b.dt - window_start).total_seconds() / 3600
        bounds = [
            miles_remaining,
            to_miles(rules.BREAK_AFTER_DRIVE_HOURS - drive_since_break),
            next_fuel_at - miles_done,
            to_miles(rules.MAX_DRIVE_HOURS - drive_today),
            to_miles(rules.MAX_DUTY_WINDOW_HOURS - window_elapsed),
        ]
        chunk_miles = max(0.0, min(bounds))
        chunk_hours = chunk_miles * hours_per_mile

        if chunk_hours <= EPS:
            # Already sitting on a limit boundary; the checks above handle it.
            # Force a reset to avoid spinning (window/drive limit at zero room).
            reset_arr = b.dt
            b.add(rules.OFF_DUTY, rules.RESET_OFF_HOURS, note="10-hour reset")
            b.add_stop("rest", "10-hour off-duty reset", miles_done, reset_arr, b.dt)
            drive_today = 0.0
            drive_since_break = 0.0
            window_start = b.dt
            continue

        b.add(rules.DRIVING, chunk_hours, note="Driving")
        miles_done += chunk_miles
        miles_remaining -= chunk_miles
        drive_today += chunk_hours
        drive_since_break += chunk_hours
        cycle_used += chunk_hours

    # Dropoff (on duty, not driving)
    drop_arr = b.dt
    b.add(rules.ON_DUTY, rules.DROPOFF_HOURS, dropoff_label, "Dropoff")
    b.add_stop("dropoff", dropoff_label, round(total_miles, 1), drop_arr, b.dt)

    days = split_into_days(b.segments)
    return TripPlan(segments=b.segments, stops=b.stops, days=days, violations=violations)
