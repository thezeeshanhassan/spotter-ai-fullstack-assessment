import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

import { RouteMap } from "./RouteMap";
import type { TripResult } from "@/lib/types";

vi.mock("react-leaflet", () => ({
  MapContainer: (p: { children?: React.ReactNode }) => <div>{p.children}</div>,
  TileLayer: () => <div />,
  Polyline: () => <div data-testid="poly" />,
  Marker: (p: { children?: React.ReactNode }) => <div>{p.children}</div>,
  Popup: (p: { children?: React.ReactNode }) => <div>{p.children}</div>,
  useMap: () => ({ fitBounds: () => {}, setView: () => {} }),
}));

describe("RouteMap", () => {
  it("renders a polyline and a play control", () => {
    const result: TripResult = {
      id: 1,
      current_location: "A", pickup_location: "B", dropoff_location: "C", cycle_used_hrs: 0,
      route: { geometry: [[41.8, -87.6], [41.6, -93.6]], distance_miles: 220, duration_hours: 4 },
      stops: [
        { type: "pickup", label: "B", lat: 41.7, lng: -88, mile_marker: 0, arrival: "", departure: "" },
      ],
      days: [],
      violations: [],
      created_at: "",
    };
    render(<RouteMap result={result} />);
    expect(screen.getByTestId("poly")).toBeTruthy();
    expect(screen.getByRole("button", { name: /play/i })).toBeTruthy();
  });
});
