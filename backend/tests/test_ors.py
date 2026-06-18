from unittest.mock import MagicMock, patch

from api.services import ors


def test_geocode_parses_first_feature():
    fake = {"features": [{
        "properties": {"label": "Chicago, IL"},
        "geometry": {"coordinates": [-87.65, 41.85]},
    }]}
    with patch("api.services.ors.requests.get") as g:
        g.return_value = MagicMock(status_code=200, json=lambda: fake)
        out = ors.geocode("Chicago")
    assert out == {"label": "Chicago, IL", "lat": 41.85, "lng": -87.65}


def test_route_parses_summary_and_geometry():
    fake = {"features": [{
        "properties": {"summary": {"distance": 160934, "duration": 14400}},
        "geometry": {"coordinates": [[-87.65, 41.85], [-93.6, 41.6]]},
    }]}
    with patch("api.services.ors.requests.post") as p:
        p.return_value = MagicMock(status_code=200, json=lambda: fake)
        out = ors.route([(41.85, -87.65), (41.6, -93.6)])
    assert round(out["distance_miles"], 1) == 100.0  # 160934 m
    assert round(out["duration_hours"], 1) == 4.0
    assert out["geometry"][0] == [41.85, -87.65]
