import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { EldLogSheet } from "./EldLogSheet";
import type { DayLog } from "@/lib/types";

describe("EldLogSheet", () => {
  it("renders status rows and a duty polyline", () => {
    const day: DayLog = {
      date: "2026-01-01",
      segments: [
        { status: "off_duty", start: "2026-01-01T00:00:00Z", end: "2026-01-01T06:00:00Z", location: "", note: "" },
        { status: "driving", start: "2026-01-01T06:00:00Z", end: "2026-01-01T10:00:00Z", location: "", note: "" },
      ],
      totals: { off_duty: 20, sleeper: 0, driving: 4, on_duty: 0 },
      driving_miles: 220,
    };
    const { container } = render(<EldLogSheet day={day} dayNumber={1} totalDays={1} />);
    expect(container.querySelectorAll("svg text").length).toBeGreaterThan(4);
    expect(container.querySelector("polyline")).toBeTruthy();
  });
});
