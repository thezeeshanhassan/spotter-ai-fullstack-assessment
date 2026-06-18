"""HOS timeline engine. Pure Python — no Django imports.

Builds an ordered list of duty-status Segments from trip distance/duration and
the driver's current cycle usage, applying FMCSA property-carrying rules.
"""

from __future__ import annotations

from datetime import datetime, timedelta

from . import rules
from .types import Segment, Stop, TripPlan

EPS = 1e-6


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

    Single-day path (this task): pickup on-duty, driving broken into chunks with
    a 30-min break after 8h cumulative driving and a fuel stop every 1,000 miles,
    then dropoff on-duty. Multi-day resets and the 70h cycle are layered on in a
    later task; the single-day path leaves violations empty.
    """
    b = _Builder(start)
    hours_per_mile = (total_drive_hours / total_miles) if total_miles > EPS else 0.0

    # Pickup (on duty, not driving)
    pickup_arr = b.dt
    b.add(rules.ON_DUTY, rules.PICKUP_HOURS, pickup_label, "Pickup")
    b.add_stop("pickup", pickup_label, 0.0, pickup_arr, b.dt)

    miles_remaining = total_miles
    miles_done = 0.0
    drive_since_break = 0.0
    next_fuel_at = rules.FUEL_INTERVAL_MILES

    while miles_remaining > EPS:
        # Chunk is bounded by: miles left, miles until the next required break,
        # and miles until the next fuel stop.
        break_miles = (
            (rules.BREAK_AFTER_DRIVE_HOURS - drive_since_break) / hours_per_mile
            if hours_per_mile > EPS else miles_remaining
        )
        fuel_miles = next_fuel_at - miles_done
        chunk_miles = min(miles_remaining, break_miles, fuel_miles)
        chunk_hours = chunk_miles * hours_per_mile

        b.add(rules.DRIVING, chunk_hours, note="Driving")
        miles_done += chunk_miles
        miles_remaining -= chunk_miles
        drive_since_break += chunk_hours

        if miles_remaining <= EPS:
            break

        # Fuel stop reached (and trip not finished)?
        if miles_done >= next_fuel_at - EPS:
            fuel_arr = b.dt
            b.add(rules.ON_DUTY, rules.FUEL_DURATION_HOURS, note="Fuel stop")
            b.add_stop("fuel", f"Fuel stop @ {round(miles_done)} mi", miles_done, fuel_arr, b.dt)
            next_fuel_at += rules.FUEL_INTERVAL_MILES
        # 30-minute break required after 8h cumulative driving?
        elif drive_since_break >= rules.BREAK_AFTER_DRIVE_HOURS - EPS:
            break_arr = b.dt
            b.add(rules.ON_DUTY, rules.BREAK_DURATION_HOURS, note="30-min break")
            b.add_stop("break", "30-min break", miles_done, break_arr, b.dt)
            drive_since_break = 0.0

    # Dropoff (on duty, not driving)
    drop_arr = b.dt
    b.add(rules.ON_DUTY, rules.DROPOFF_HOURS, dropoff_label, "Dropoff")
    b.add_stop("dropoff", dropoff_label, round(total_miles, 1), drop_arr, b.dt)

    return TripPlan(segments=b.segments, stops=b.stops, days=[], violations=[])
