import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

import { TripForm } from "./TripForm";

describe("TripForm", () => {
  it("submits entered values", () => {
    const onSubmit = vi.fn();
    render(<TripForm onSubmit={onSubmit} loading={false} />);
    fireEvent.change(screen.getByLabelText(/current/i), { target: { value: "Chicago" } });
    fireEvent.change(screen.getByLabelText(/pickup/i), { target: { value: "Joliet" } });
    fireEvent.change(screen.getByLabelText(/dropoff/i), { target: { value: "Des Moines" } });
    fireEvent.change(screen.getByLabelText(/cycle/i), { target: { value: "10" } });
    fireEvent.click(screen.getByRole("button", { name: /plan/i }));
    expect(onSubmit).toHaveBeenCalledWith({
      current_location: "Chicago",
      pickup_location: "Joliet",
      dropoff_location: "Des Moines",
      cycle_used_hrs: 10,
    });
  });

  it("does not submit when a field is empty", () => {
    const onSubmit = vi.fn();
    render(<TripForm onSubmit={onSubmit} loading={false} />);
    fireEvent.click(screen.getByRole("button", { name: /plan/i }));
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
