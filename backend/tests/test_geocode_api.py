import pytest
from rest_framework.test import APIClient


@pytest.mark.django_db
def test_suggest_returns_results(monkeypatch):
    from api.services import ors
    monkeypatch.setattr(ors, "autocomplete", lambda q, size=5: [
        {"label": "Chicago, IL, USA", "lat": 41.8, "lng": -87.6},
    ])
    res = APIClient().get("/api/geocode/?q=chic")
    assert res.status_code == 200
    assert res.json()["results"][0]["label"].startswith("Chicago")


@pytest.mark.django_db
def test_suggest_short_query_empty():
    res = APIClient().get("/api/geocode/?q=c")
    assert res.status_code == 200
    assert res.json()["results"] == []
