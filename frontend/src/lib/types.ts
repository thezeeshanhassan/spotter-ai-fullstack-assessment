export interface Place {
  label: string;
  lat: number | null;
  lng: number | null;
}

export interface TripInput {
  current_location: string;
  pickup_location: string;
  dropoff_location: string;
  cycle_used_hrs: number;
  current_lat?: number | null;
  current_lng?: number | null;
  pickup_lat?: number | null;
  pickup_lng?: number | null;
  dropoff_lat?: number | null;
  dropoff_lng?: number | null;
}

export type DutyStatus = "off_duty" | "sleeper" | "driving" | "on_duty";

export interface Segment {
  status: DutyStatus;
  start: string; // ISO datetime
  end: string;
  location: string;
  note: string;
}

export interface Stop {
  type: "pickup" | "dropoff" | "fuel" | "rest" | "break";
  label: string;
  mile_marker: number;
  lat: number | null;
  lng: number | null;
  arrival: string;
  departure: string;
}

export interface DayLog {
  date: string; // YYYY-MM-DD
  segments: Segment[];
  totals: Record<DutyStatus, number>;
  driving_miles: number;
}

export interface Violation {
  rule: string;
  message: string;
  suggestion: string;
}

export interface RouteSummary {
  distance_miles: number;
  duration_hours: number;
  geometry: [number, number][]; // [lat, lng]
}

export interface TripResult {
  id: number;
  current_location: string;
  pickup_location: string;
  dropoff_location: string;
  cycle_used_hrs: number;
  route: RouteSummary;
  stops: Stop[];
  days: DayLog[];
  violations: Violation[];
  created_at: string;
}
