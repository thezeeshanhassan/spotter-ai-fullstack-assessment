import type { Place, TripInput, TripResult } from "./types";

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

export async function suggestPlaces(
  query: string,
  size = 20,
  signal?: AbortSignal,
): Promise<Place[]> {
  if (query.trim().length < 2) return [];
  try {
    const res = await fetch(
      `${BASE}/api/geocode/?q=${encodeURIComponent(query)}&size=${size}`,
      { signal },
    );
    if (!res.ok) return [];
    const body = await res.json();
    return body.results ?? [];
  } catch {
    return []; // network/abort errors -> no suggestions
  }
}
