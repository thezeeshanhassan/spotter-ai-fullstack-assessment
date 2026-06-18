from django.urls import path

from . import views

urlpatterns = [
    path("health/", views.health),
    path("geocode/", views.geocode_suggest),
    path("trips/", views.create_trip),
    path("trips/<int:pk>/", views.get_trip),
]
