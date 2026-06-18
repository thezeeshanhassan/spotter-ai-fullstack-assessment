import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

import { TripDashboard } from "./TripDashboard";
import * as api from "@/lib/api";

vi.mock("./RouteMap", () => ({ RouteMap: () => <div>map</div> }));

async function pick(labelRe: RegExp, text: string) {
  fireEvent.change(screen.getByLabelText(labelRe), { target: { value: text } });
  const option = await screen.findByText(`${text} City`);
  fireEvent.click(option);
}

describe("TripDashboard", () => {
  it("renders log sheets after planning a trip", async () => {
    vi.spyOn(api, "suggestPlaces").mockImplementation(async (q: string) => [
      { label: `${q.trim()} City`, lat: 40, lng: -80 },
    ]);
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
    await pick(/current/i, "Aa");
    await pick(/pickup/i, "Bb");
    await pick(/dropoff/i, "Cc");
    fireEvent.change(screen.getByLabelText(/cycle/i), { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: /plan/i }));

    await waitFor(() => expect(screen.getAllByText(/2026-01-01/).length).toBeGreaterThan(0));
  });
});
