from datetime import datetime

from hos import rules
from hos.engine import build_timeline


def test_multiday_inserts_10h_reset():
    # 1300 miles ~ 24h drive -> exceeds 11h/day, needs at least two 10h resets
    plan = build_timeline(
        total_miles=1300, total_drive_hours=24.0, cycle_used_hours=0.0,
        start=datetime(2026, 1, 1, 6, 0), pickup_label="A", dropoff_label="B",
    )
    resets = [
        s for s in plan.segments
        if s.status == "off_duty" and abs(s.duration_hours() - rules.RESET_OFF_HOURS) < 1e-6
    ]
    assert len(resets) >= 2
    # No single driving window exceeds the 11h driving limit.
    window_drive = 0.0
    for s in plan.segments:
        if s.status == "driving":
            window_drive += s.duration_hours()
            assert window_drive <= rules.MAX_DRIVE_HOURS + 1e-6
        elif s.status == "off_duty" and s.duration_hours() >= rules.RESET_OFF_HOURS - 1e-6:
            window_drive = 0.0


def test_cycle_limit_triggers_34h_restart():
    # Seeded near the 70h cap with more driving to do -> a 34h restart must appear
    plan = build_timeline(
        total_miles=400, total_drive_hours=8.0, cycle_used_hours=69.0,
        start=datetime(2026, 1, 1, 6, 0), pickup_label="A", dropoff_label="B",
    )
    assert any(v.rule == "70h_cycle" for v in plan.violations)
    restarts = [
        s for s in plan.segments
        if s.status == "off_duty" and s.duration_hours() >= rules.RESTART_OFF_HOURS - 1e-6
    ]
    assert len(restarts) >= 1


def test_fuel_stop_every_1000_miles():
    plan = build_timeline(
        total_miles=2100, total_drive_hours=38.0, cycle_used_hours=0.0,
        start=datetime(2026, 1, 1, 6, 0), pickup_label="A", dropoff_label="B",
    )
    fuel = [s for s in plan.segments if "fuel" in s.note.lower()]
    assert len(fuel) >= 2
