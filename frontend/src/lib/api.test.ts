import { describe, it, expect, vi } from "vitest";

import { createTrip } from "./api";

describe("api client", () => {
  it("posts trip and returns parsed result", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => ({
          id: 1,
          route: { distance_miles: 220, duration_hours: 4, geometry: [] },
          stops: [],
          days: [],
          violations: [],
        }),
      }),
    );

    const r = await createTrip({
      current_location: "A",
      pickup_location: "B",
      dropoff_location: "C",
      cycle_used_hrs: 0,
    });
    expect(r.route.distance_miles).toBe(220);
  });

  it("throws on error response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ detail: "bad" }),
      }),
    );

    await expect(
      createTrip({ current_location: "", pickup_location: "", dropoff_location: "", cycle_used_hrs: 0 }),
    ).rejects.toThrow();
  });
});
