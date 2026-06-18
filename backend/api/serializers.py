from rest_framework import serializers

from .models import LogDay, Stop, Trip


class TripInputSerializer(serializers.Serializer):
    """Validates the trip-planning request body."""

    current_location = serializers.CharField(max_length=255)
    pickup_location = serializers.CharField(max_length=255)
    dropoff_location = serializers.CharField(max_length=255)
    cycle_used_hrs = serializers.FloatField(min_value=0, max_value=70)


class StopSerializer(serializers.ModelSerializer):
    class Meta:
        model = Stop
        fields = ["type", "label", "mile_marker", "lat", "lng", "arrival", "departure"]


class LogDaySerializer(serializers.ModelSerializer):
    class Meta:
        model = LogDay
        fields = ["date", "segments", "totals"]


class TripSerializer(serializers.ModelSerializer):
    """Full trip output: route summary + stops + per-day logs."""

    route = serializers.SerializerMethodField()
    stops = StopSerializer(many=True, read_only=True)
    days = LogDaySerializer(many=True, read_only=True)
    violations = serializers.JSONField(read_only=True)

    class Meta:
        model = Trip
        fields = ["id", "current_location", "pickup_location", "dropoff_location",
                  "cycle_used_hrs", "route", "stops", "days", "violations", "created_at"]

    def get_route(self, obj):
        return {
            "distance_miles": obj.total_miles,
            "duration_hours": obj.total_drive_hours,
            "geometry": obj.route_geometry,
        }
