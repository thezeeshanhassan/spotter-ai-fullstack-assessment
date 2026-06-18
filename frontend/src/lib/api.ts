import type { TripInput, TripResult } from "./types";

const BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

async function handle(res: Response): Promise<TripResult> {
  if (!res.ok) {
    let detail = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      detail = typeof body === "object" ? JSON.stringify(body) : detail;
    } catch {
      /* ignore non-JSON error bodies */
    }
    throw new Error(detail);
  }
  return res.json();
}

export async function createTrip(input: TripInput): Promise<TripResult> {
  const res = await fetch(`${BASE}/api/trips/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return handle(res);
}

export async function getTrip(id: number): Promise<TripResult> {
  const res = await fetch(`${BASE}/api/trips/${id}/`);
  return handle(res);
}
