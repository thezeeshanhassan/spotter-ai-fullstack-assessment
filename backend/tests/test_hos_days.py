from datetime import datetime, time, timedelta

from hos.engine import build_timeline


def test_days_split_and_total_24h():
    plan = build_timeline(
        total_miles=1300, total_drive_hours=24.0, cycle_used_hours=0.0,
        start=datetime(2026, 1, 1, 6, 0), pickup_label="A", dropoff_label="B",
    )
    assert len(plan.days) >= 2
    for day in plan.days[1:-1]:  # full interior days
        assert abs(sum(day.totals.values()) - 24.0) < 1e-6
    # Every segment lies within its day: starts on the day and ends no later
    # than the following midnight (a segment may end exactly at midnight).
    for day in plan.days:
        next_midnight = datetime.combine(day.date + timedelta(days=1), time.min)
        for s in day.segments:
            assert s.start.date() == day.date
            assert s.end <= next_midnight + timedelta(microseconds=1)

