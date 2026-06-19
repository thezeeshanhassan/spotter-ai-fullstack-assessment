import L from "leaflet";
import { Fuel, MapPin, Pause, PackageCheck, Play, Bed, Coffee } from "lucide-react";
import * as React from "react";
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from "react-leaflet";

import "leaflet/dist/leaflet.css";

import { Button } from "@/components/ui/button";
import { useTheme } from "@/lib/theme";
import type { Stop, TripResult } from "@/lib/types";

const PLAYBACK_SECONDS = 14; // wall-clock seconds to animate the whole trip

const STOP_COLORS: Record<Stop["type"], string> = {
  pickup: "#22c55e",
  dropoff: "#ef4444",
  fuel: "#f59e0b",
  rest: "#6366f1",
  break: "#06b6d4",
};

function dotIcon(color: string) {
  return L.divIcon({
    className: "",
    html: `<span style="display:block;width:14px;height:14px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 0 6px ${color}"></span>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

// The 🚚 glyph faces LEFT by default; flip it horizontally to point toward the
// direction of travel (toward pickup, then dropoff).
function truckIcon(faceRight: boolean) {
  return L.divIcon({
    className: "",
    html: `<span style="display:inline-block;font-size:22px;filter:drop-shadow(0 1px 3px rgba(0,0,0,.6));transform:scaleX(${faceRight ? -1 : 1})">🚚</span>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Position + facing of the truck at a given progress (0..1) along the route. */
function truckAt(geometry: [number, number][], progress: number): { pos: [number, number]; faceRight: boolean } {
  if (geometry.length === 0) return { pos: [0, 0], faceRight: true };
  if (geometry.length === 1) return { pos: geometry[0], faceRight: true };
  const span = progress * (geometry.length - 1);
  const i = Math.min(geometry.length - 2, Math.floor(span));
  const frac = span - i;
  const pos: [number, number] = [
    lerp(geometry[i][0], geometry[i + 1][0], frac),
    lerp(geometry[i][1], geometry[i + 1][1], frac),
  ];
  // Heading east (increasing longitude) → face right.
  const faceRight = geometry[i + 1][1] >= geometry[i][1];
  return { pos, faceRight };
}

function FitBounds({ geometry }: { geometry: [number, number][] }) {
  const map = useMap();
  React.useEffect(() => {
    if (geometry.length > 1) {
      map.fitBounds(geometry as L.LatLngBoundsExpression, { padding: [40, 40] });
    }
  }, [geometry, map]);
  return null;
}

function fmtClock(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h}h ${m.toString().padStart(2, "0")}m`;
}

export function RouteMap({ result }: { result: TripResult }) {
  const theme = useTheme();
  const tileUrl =
    theme === "dark"
      ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";
  const geometry = result.route.geometry;
  const [progress, setProgress] = React.useState(0);
  const [playing, setPlaying] = React.useState(false);
  const raf = React.useRef<number | null>(null);
  const last = React.useRef<number | null>(null);

  React.useEffect(() => {
    if (!playing) return;
    function step(ts: number) {
      if (last.current == null) last.current = ts;
      const dt = (ts - last.current) / 1000;
      last.current = ts;
      setProgress((p) => {
        const next = p + dt / PLAYBACK_SECONDS;
        if (next >= 1) {
          setPlaying(false);
          return 1;
        }
        return next;
      });
      raf.current = requestAnimationFrame(step);
    }
    raf.current = requestAnimationFrame(step);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
      last.current = null;
    };
  }, [playing]);

  function toggle() {
    if (progress >= 1) setProgress(0);
    setPlaying((p) => !p);
  }

  const truck = truckAt(geometry, progress);
  const elapsedHours = progress * result.route.duration_hours;
  const elapsedMiles = progress * result.route.distance_miles;
  const center = geometry[0] ?? [39.5, -98.35];

  return (
    <div className="relative h-[420px] w-full overflow-hidden rounded-xl border border-border">
      <MapContainer center={center as L.LatLngExpression} zoom={5} className="h-full w-full" scrollWheelZoom>
        <TileLayer attribution="&copy; OpenStreetMap contributors &copy; CARTO" url={tileUrl} />
        <FitBounds geometry={geometry} />
        {geometry.length > 1 && (
          <Polyline positions={geometry as L.LatLngExpression[]} pathOptions={{ color: "#818cf8", weight: 4, opacity: 0.9 }} />
        )}
        {result.stops
          .filter((s) => s.lat != null && s.lng != null)
          .map((s, i) => (
            <Marker key={i} position={[s.lat as number, s.lng as number]} icon={dotIcon(STOP_COLORS[s.type] ?? "#999")}>
              <Popup>
                <strong className="capitalize">{s.type}</strong>
                <br />
                {s.label}
                <br />
                Mile {Math.round(s.mile_marker)}
              </Popup>
            </Marker>
          ))}
        {geometry.length > 0 && (
          <Marker position={truck.pos as L.LatLngExpression} icon={truckIcon(truck.faceRight)} />
        )}
      </MapContainer>

      {/* Playback overlay */}
      <div className="absolute bottom-3 left-3 right-3 z-[1000] flex items-center gap-3 rounded-lg glass px-3 py-2">
        <Button type="button" size="icon" onClick={toggle} aria-label={playing ? "Pause" : "Play"}>
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>
        <div className="flex-1">
          <div className="mb-1 flex justify-between text-xs text-muted-foreground">
            <span>{fmtClock(elapsedHours)} driving</span>
            <span>{Math.round(elapsedMiles)} / {Math.round(result.route.distance_miles)} mi</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${progress * 100}%` }} />
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="absolute right-3 top-3 z-[1000] flex flex-col gap-1 rounded-lg glass p-2 text-[11px]">
        <LegendItem icon={<MapPin className="h-3 w-3" style={{ color: STOP_COLORS.pickup }} />} label="Pickup" />
        <LegendItem icon={<PackageCheck className="h-3 w-3" style={{ color: STOP_COLORS.dropoff }} />} label="Dropoff" />
        <LegendItem icon={<Fuel className="h-3 w-3" style={{ color: STOP_COLORS.fuel }} />} label="Fuel" />
        <LegendItem icon={<Bed className="h-3 w-3" style={{ color: STOP_COLORS.rest }} />} label="Rest" />
        <LegendItem icon={<Coffee className="h-3 w-3" style={{ color: STOP_COLORS.break }} />} label="Break" />
      </div>
    </div>
  );
}

function LegendItem({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-muted-foreground">
      {icon}
      {label}
    </span>
  );
}
