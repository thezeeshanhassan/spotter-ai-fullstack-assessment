import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

import { TripDashboard } from "./TripDashboard";
import * as api from "@/lib/api";

vi.mock("./RouteMap", () => ({ RouteMap: () => <div>map</div> }));

describe("TripDashboard", () => {
  it("renders log sheets after planning a trip", async () => {
    vi.spyOn(api, "createTrip").mockResolvedValue({
      id: 1,
      current_location: "A", pickup_location: "B", dropoff_location: "C", cycle_used_hrs: 0,
      route: { distance_miles: 220, duration_hours: 4, geometry: [] },
      stops: [],
      days: [{ date: "2026-01-01", segments: [], totals: { off_duty: 24, sleeper: 0, driving: 0, on_duty: 0 } }],
      violations: [],
      created_at: "",
    });

    render(<TripDashboard />);
    fireEvent.change(screen.getByLabelText(/current/i), { target: { value: "A" } });
    fireEvent.change(screen.getByLabelText(/pickup/i), { target: { value: "B" } });
    fireEvent.change(screen.getByLabelText(/dropoff/i), { target: { value: "C" } });
    fireEvent.change(screen.getByLabelText(/cycle/i), { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: /plan/i }));

    await waitFor(() => expect(screen.getByText(/2026-01-01/)).toBeTruthy());
  });
});
