"""Dataclasses for the HOS engine. Pure Python — no Django imports."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime


@dataclass
class Segment:
    """A single duty-status period on the timeline.

    status is one of: "off_duty", "sleeper", "driving", "on_duty".
    """

    status: str
    start: datetime
    end: datetime
    location: str = ""
    note: str = ""

    def duration_hours(self) -> float:
        return (self.end - self.start).total_seconds() / 3600


@dataclass
class Stop:
    """A point of interest along the route (pickup, dropoff, fuel, rest, break)."""

    type: str
    label: str
    mile_marker: float
    lat: float | None
    lng: float | None
    arrival: datetime
    departure: datetime


@dataclass
class DayLog:
    """One calendar day of duty-status segments plus per-status hour totals."""

    date: date
    segments: list[Segment] = field(default_factory=list)
    totals: dict[str, float] = field(default_factory=dict)


@dataclass
class Violation:
    """A flagged HOS rule condition with a human-readable fix suggestion."""

    rule: str
    message: str
    suggestion: str = ""


@dataclass
class TripPlan:
    """Full output of the HOS engine."""

    segments: list[Segment] = field(default_factory=list)
    stops: list[Stop] = field(default_factory=list)
    days: list[DayLog] = field(default_factory=list)
    violations: list[Violation] = field(default_factory=list)
