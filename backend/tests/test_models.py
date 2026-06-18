import pytest

from api.models import Trip


@pytest.mark.django_db
def test_trip_relations():
    t = Trip.objects.create(
        current_location="A", pickup_location="B", dropoff_location="C",
        cycle_used_hrs=0, total_miles=100, total_drive_hours=2,
        route_geometry=[[1, 2]],
    )
    t.stops.create(
        type="pickup", label="B", mile_marker=0, lat=1, lng=2,
        arrival="2026-01-01T06:00:00Z", departure="2026-01-01T07:00:00Z",
    )
    t.days.create(date="2026-01-01", segments=[], totals={})
    assert t.stops.count() == 1
    assert t.days.count() == 1
