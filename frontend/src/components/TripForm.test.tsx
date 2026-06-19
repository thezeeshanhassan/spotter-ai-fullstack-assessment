import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { TripForm } from "./TripForm";
import * as api from "@/lib/api";

// Each query returns one suggestion labelled after the query.
beforeEach(() => {
  vi.spyOn(api, "suggestPlaces").mockImplementation(async (q: string) => [
    { label: `${q.trim()} City`, lat: 40, lng: -80 },
  ]);
});

async function pick(labelRe: RegExp, text: string) {
  fireEvent.change(screen.getByLabelText(labelRe), { target: { value: text } });
  const option = await screen.findByText(`${text} City`);
  fireEvent.click(option);
}

describe("TripForm", () => {
  it("submits with picked places and their coordinates", async () => {
    const onSubmit = vi.fn();
    render(<TripForm onSubmit={onSubmit} loading={false} />);
    await pick(/current/i, "Chicago");
    await pick(/pickup/i, "Joliet");
    await pick(/dropoff/i, "Des Moines");
    fireEvent.change(screen.getByLabelText(/cycle/i), { target: { value: "10" } });
    fireEvent.click(screen.getByRole("button", { name: /plan/i }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        current_location: "Chicago City",
        pickup_location: "Joliet City",
        dropoff_location: "Des Moines City",
        cycle_used_hrs: 10,
        current_lat: 40,
        current_lng: -80,
      }),
    );
  });

  it("blocks submit when locations are not chosen from search", async () => {
    const onSubmit = vi.fn();
    render(<TripForm onSubmit={onSubmit} loading={false} />);
    fireEvent.change(screen.getByLabelText(/current/i), { target: { value: "typed text" } });
    // Button stays disabled until all three locations are picked from search.
    const btn = screen.getByRole("button", { name: /plan/i });
    expect(btn).toBeDisabled();
    fireEvent.click(btn);
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
