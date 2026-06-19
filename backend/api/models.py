from django.db import models


class Trip(models.Model):
    """A planned trip with its computed route summary."""

    current_location = models.CharField(max_length=255)
    pickup_location = models.CharField(max_length=255)
    dropoff_location = models.CharField(max_length=255)
    cycle_used_hrs = models.FloatField(default=0)
    total_miles = models.FloatField(default=0)
    total_drive_hours = models.FloatField(default=0)
    route_geometry = models.JSONField(default=list)  # [[lat, lng], ...]
    violations = models.JSONField(default=list)  # [{rule, message, suggestion}]
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return f"Trip {self.pk}: {self.pickup_location} -> {self.dropoff_location}"


class Stop(models.Model):
    """A point along the route: pickup, dropoff, fuel, rest, or break."""

    trip = models.ForeignKey(Trip, related_name="stops", on_delete=models.CASCADE)
    type = models.CharField(max_length=20)
    label = models.CharField(max_length=255)
    mile_marker = models.FloatField(default=0)
    lat = models.FloatField(null=True, blank=True)
    lng = models.FloatField(null=True, blank=True)
    arrival = models.DateTimeField()
    departure = models.DateTimeField()

    class Meta:
        ordering = ["arrival"]


class LogDay(models.Model):
    """One calendar day's duty-status segments and per-status totals."""

    trip = models.ForeignKey(Trip, related_name="days", on_delete=models.CASCADE)
    date = models.DateField()
    segments = models.JSONField(default=list)  # [{status, start, end, location, note}]
    totals = models.JSONField(default=dict)    # {off_duty, sleeper, driving, on_duty}
    driving_miles = models.FloatField(default=0)  # total miles driven this day

    class Meta:
        ordering = ["date"]
