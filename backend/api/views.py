from dataclasses import asdict

from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from hos.engine import build_timeline

from .models import LogDay, Stop, Trip
from .serializers import TripInputSerializer, TripSerializer
from .services import ors
from .services.ors import ORSError


@api_view(["GET"])
def health(request):
    return Response({"status": "ok"})


@api_view(["GET"])
def geocode_suggest(request):
    """Proxy ORS autocomplete so the API key stays server-side."""
    query = (request.query_params.get("q") or "").strip()
    if len(query) < 2:
        return Response({"results": []})
    try:
        results = ors.autocomplete(query)
    except ORSError:
        results = []
    return Response({"results": results})


def _downsample(geometry, max_points=800):
    """Thin a dense route geometry, always keeping the first and last points."""
    n = len(geometry)
    if n <= max_points:
        return geometry
    step = n / max_points
    out = [geometry[int(i * step)] for i in range(max_points)]
    out[-1] = geometry[-1]
    return out


def _friendly_error(msg: str) -> str:
    """Turn a raw ORS error into a user-facing message."""
    low = msg.lower()
    if "6000000" in msg or "distance must not be greater" in low:
        return ("This route is too long to plan (over ~3,700 miles / 6,000 km). "
                "Pick locations that are closer together.")
    if "routable point" in low or "404" in msg or "no route" in low:
        return ("Couldn't find a road route between these locations. "
                "Make sure each is a real place selected from the search, on the same landmass.")
    if "geocode" in low or "no geocode" in low:
        return "One of the locations couldn't be found. Pick a place from the search suggestions."
    return "Could not plan this route. Please check the locations and try again."


def _interpolate(geometry, fraction):
    """Pick a [lat, lng] point at the given fraction along the geometry."""
    if not geometry:
        return (None, None)
    idx = max(0, min(len(geometry) - 1, round(fraction * (len(geometry) - 1))))
    point = geometry[idx]
    return (point[0], point[1])


@api_view(["POST"])
def create_trip(request):
    serializer = TripInputSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data

    def resolve(prefix, label):
        """Use the picked place's coords when present, else geocode the text."""
        lat, lng = data.get(f"{prefix}_lat"), data.get(f"{prefix}_lng")
        if lat is not None and lng is not None:
            return {"label": label, "lat": lat, "lng": lng}
        return ors.geocode(label)

    # Resolve the three locations, then route current -> pickup -> dropoff.
    try:
        current = resolve("current", data["current_location"])
        pickup = resolve("pickup", data["pickup_location"])
        dropoff = resolve("dropoff", data["dropoff_location"])
        routed = ors.route([
            (current["lat"], current["lng"]),
            (pickup["lat"], pickup["lng"]),
            (dropoff["lat"], dropoff["lng"]),
        ])
    except ORSError as exc:
        return Response(
            {"detail": _friendly_error(str(exc))},
            status=status.HTTP_422_UNPROCESSABLE_ENTITY,
        )

    geometry = _downsample(routed["geometry"])
    legs = routed.get("legs") or []
    pickup_offset_miles = legs[0]["distance_miles"] if legs else 0.0

    plan = build_timeline(
        total_miles=routed["distance_miles"],
        total_drive_hours=routed["duration_hours"],
        cycle_used_hours=data["cycle_used_hrs"],
        start=timezone.now(),
        pickup_label=pickup["label"],
        dropoff_label=dropoff["label"],
        pickup_offset_miles=pickup_offset_miles,
    )

    trip = Trip.objects.create(
        current_location=current["label"],
        pickup_location=pickup["label"],
        dropoff_location=dropoff["label"],
        cycle_used_hrs=data["cycle_used_hrs"],
        total_miles=routed["distance_miles"],
        total_drive_hours=routed["duration_hours"],
        route_geometry=geometry,
        violations=[asdict(v) for v in plan.violations],
    )

    total_miles = routed["distance_miles"] or 1.0
    for stop in plan.stops:
        lat, lng = stop.lat, stop.lng
        if lat is None:
            lat, lng = _interpolate(geometry, stop.mile_marker / total_miles)
        Stop.objects.create(
            trip=trip, type=stop.type, label=stop.label, mile_marker=stop.mile_marker,
            lat=lat, lng=lng, arrival=stop.arrival, departure=stop.departure,
        )

    for day in plan.days:
        LogDay.objects.create(
            trip=trip, date=day.date, totals=day.totals,
            driving_miles=round(day.driving_miles, 1),
            segments=[
                {
                    "status": s.status,
                    "start": s.start.isoformat(),
                    "end": s.end.isoformat(),
                    "location": s.location,
                    "note": s.note,
                }
                for s in day.segments
            ],
        )

    return Response(TripSerializer(trip).data, status=status.HTTP_201_CREATED)


@api_view(["GET"])
def get_trip(request, pk):
    trip = get_object_or_404(Trip, pk=pk)
    return Response(TripSerializer(trip).data)
