"""OpenRouteService client: geocoding + driving-HGV routing.

The API key lives in settings.ORS_API_KEY (backend env only). Network calls go
through module-level ``requests`` so tests can patch them.
"""

from __future__ import annotations

import requests
from django.conf import settings

GEOCODE_URL = "https://api.openrouteservice.org/geocode/search"
DIRECTIONS_URL = "https://api.openrouteservice.org/v2/directions/driving-hgv/geojson"

METERS_PER_MILE = 1609.34
SECONDS_PER_HOUR = 3600.0
TIMEOUT = 20


class ORSError(RuntimeError):
    """Raised when OpenRouteService returns an error or no usable result."""


def geocode(query: str) -> dict:
    """Resolve a free-text place to {label, lat, lng} (first match)."""
    resp = requests.get(
        GEOCODE_URL,
        params={"api_key": settings.ORS_API_KEY, "text": query, "size": 1},
        timeout=TIMEOUT,
    )
    if resp.status_code != 200:
        raise ORSError(f"Geocode failed ({resp.status_code}) for {query!r}")
    features = resp.json().get("features") or []
    if not features:
        raise ORSError(f"No geocode result for {query!r}")
    feat = features[0]
    lng, lat = feat["geometry"]["coordinates"][:2]
    label = feat.get("properties", {}).get("label", query)
    return {"label": label, "lat": lat, "lng": lng}


def route(coords: list[tuple[float, float]]) -> dict:
    """Route through ordered (lat, lng) waypoints.

    Returns {distance_miles, duration_hours, geometry:[[lat,lng], ...]}.
    """
    body = {"coordinates": [[lng, lat] for (lat, lng) in coords]}
    resp = requests.post(
        DIRECTIONS_URL,
        json=body,
        headers={"Authorization": settings.ORS_API_KEY},
        timeout=TIMEOUT,
    )
    if resp.status_code != 200:
        raise ORSError(f"Routing failed ({resp.status_code})")
    features = resp.json().get("features") or []
    if not features:
        raise ORSError("No route returned")
    feat = features[0]
    props = feat["properties"]
    summary = props["summary"]
    geometry = [[lat, lng] for (lng, lat) in feat["geometry"]["coordinates"]]
    legs = [
        {
            "distance_miles": seg["distance"] / METERS_PER_MILE,
            "duration_hours": seg["duration"] / SECONDS_PER_HOUR,
        }
        for seg in props.get("segments", [])
    ]
    return {
        "distance_miles": summary["distance"] / METERS_PER_MILE,
        "duration_hours": summary["duration"] / SECONDS_PER_HOUR,
        "geometry": geometry,
        "legs": legs,
    }
