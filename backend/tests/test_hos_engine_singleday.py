from datetime import datetime

from hos import rules
from hos.engine import build_timeline


def test_short_trip_pickup_drive_dropoff():
    # 220 miles, 4h drive, fits one day, no break (<8h), no fuel (<1000mi)
    plan = build_timeline(
        total_miles=220, total_drive_hours=4.0, cycle_used_hours=0.0,
        start=datetime(2026, 1, 1, 6, 0), pickup_label="Chicago", dropoff_label="Des Moines",
    )
    statuses = [s.status for s in plan.segments]
    assert statuses == ["on_duty", "driving", "on_duty"]
    assert plan.segments[0].duration_hours() == rules.PICKUP_HOURS
    assert plan.segments[1].duration_hours() == 4.0
    assert plan.segments[2].duration_hours() == rules.DROPOFF_HOURS
    assert plan.violations == []


def test_break_inserted_after_8h_driving():
    # 550 miles, 10h drive -> needs a 30-min break after 8h cumulative driving
    plan = build_timeline(
        total_miles=550, total_drive_hours=10.0, cycle_used_hours=0.0,
        start=datetime(2026, 1, 1, 5, 0), pickup_label="A", dropoff_label="B",
    )
    assert any(s.status == "on_duty" and "break" in s.note.lower() for s in plan.segments)
    driving = sum(s.duration_hours() for s in plan.segments if s.status == "driving")
    assert abs(driving - 10.0) < 1e-6


def test_pickup_occurs_after_driving_to_pickup_point():
    # current->pickup is 110mi of a 550mi total; pickup must follow that drive
    plan = build_timeline(
        total_miles=550, total_drive_hours=10.0, cycle_used_hours=0.0,
        start=datetime(2026, 1, 1, 5, 0), pickup_label="P", dropoff_label="D",
        pickup_offset_miles=110.0,
    )
    # first segment is driving (current -> pickup), not the pickup stop
    assert plan.segments[0].status == "driving"
    pickup_segs = [s for s in plan.segments if s.note == "Pickup"]
    assert len(pickup_segs) == 1
    # driving happened before the pickup stop
    assert plan.segments[0].end <= pickup_segs[0].start
    driving = sum(s.duration_hours() for s in plan.segments if s.status == "driving")
    assert abs(driving - 10.0) < 1e-6
