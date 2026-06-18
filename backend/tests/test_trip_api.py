import pytest
from rest_framework.test import APIClient


@pytest.mark.django_db
def test_create_trip(monkeypatch):
    from api.services import ors
    monkeypatch.setattr(ors, "geocode", lambda q: {"label": q, "lat": 41.8, "lng": -87.6})
    monkeypatch.setattr(ors, "route", lambda c: {
        "distance_miles": 220, "duration_hours": 4.0,
        "geometry": [[41.8, -87.6], [41.6, -93.6]],
        "legs": [{"distance_miles": 20, "duration_hours": 0.4},
                 {"distance_miles": 200, "duration_hours": 3.6}],
    })
    res = APIClient().post("/api/trips/", {
        "current_location": "Chicago", "pickup_location": "Joliet",
        "dropoff_location": "Des Moines", "cycle_used_hrs": 0,
    }, format="json")
    assert res.status_code == 201
    body = res.json()
    assert "days" in body and len(body["days"]) >= 1
    assert body["route"]["distance_miles"] == 220
    assert len(body["stops"]) >= 2  # at least pickup + dropoff
    # round-trip: GET the persisted trip
    got = APIClient().get(f"/api/trips/{body['id']}/")
    assert got.status_code == 200
    assert got.json()["id"] == body["id"]


@pytest.mark.django_db
def test_create_trip_validation():
    res = APIClient().post("/api/trips/", {"current_location": "X"}, format="json")
    assert res.status_code == 400


@pytest.mark.django_db
def test_create_trip_unroutable_returns_422(monkeypatch):
    from api.services import ors
    from api.services.ors import ORSError
    monkeypatch.setattr(ors, "geocode", lambda q: {"label": q, "lat": 1.0, "lng": 1.0})
    def boom(_coords):
        raise ORSError("Routing failed (404): no route")
    monkeypatch.setattr(ors, "route", boom)
    res = APIClient().post("/api/trips/", {
        "current_location": "A", "pickup_location": "B",
        "dropoff_location": "C", "cycle_used_hrs": 0,
    }, format="json")
    assert res.status_code == 422
    assert "detail" in res.json()
