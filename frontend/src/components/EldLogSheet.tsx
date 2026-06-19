import * as React from "react";

import { Card } from "@/components/ui/card";
import type { DayLog, DutyStatus, Segment } from "@/lib/types";

interface EldLogSheetProps {
  day: DayLog;
  dayNumber: number;
  totalDays: number;
  /** Render only the SVG grid (no Card wrapper / header) for embedding. */
  bare?: boolean;
}

const ROWS: { key: DutyStatus; label: string }[] = [
  { key: "off_duty", label: "1. Off Duty" },
  { key: "sleeper", label: "2. Sleeper Berth" },
  { key: "driving", label: "3. Driving" },
  { key: "on_duty", label: "4. On Duty (Not Driving)" },
];

// Geometry
const LEFT = 168;
const TOP = 30;
const HOUR_W = 28;
const GRID_W = HOUR_W * 24; // 672
const ROW_H = 34;
const GRID_H = ROW_H * 4;
const RIGHT = 64;
const WIDTH = LEFT + GRID_W + RIGHT;
const HEIGHT = TOP + GRID_H + 78;

function fracHour(iso: string, dayDate: string): number {
  const midnight = new Date(`${dayDate}T00:00:00Z`).getTime();
  const h = (new Date(iso).getTime() - midnight) / 3_600_000;
  return Math.max(0, Math.min(24, h));
}

function rowTop(status: DutyStatus): number {
  return TOP + ROWS.findIndex((r) => r.key === status) * ROW_H;
}

function rowY(status: DutyStatus): number {
  return rowTop(status) + ROW_H / 2;
}

function buildPoints(segments: Segment[], dayDate: string): string {
  const pts: string[] = [];
  for (const s of segments) {
    const x1 = LEFT + fracHour(s.start, dayDate) * HOUR_W;
    const x2 = LEFT + fracHour(s.end, dayDate) * HOUR_W;
    const y = rowY(s.status);
    pts.push(`${x1},${y}`, `${x2},${y}`);
  }
  return pts.join(" ");
}

function hourLabel(h: number): string {
  if (h === 0 || h === 24) return "M";
  if (h === 12) return "N";
  return String(h);
}

function fmtHrs(h: number): string {
  return (Math.round(h * 100) / 100).toFixed(2);
}

// Remarks only mark real duty-status changes (locations / activities), not the
// continuous Driving / Off-duty padding.
const REMARK_NOTES = new Set([
  "Pickup", "Dropoff", "Fuel stop", "30-min break", "10-hour reset", "34-hour restart",
]);

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[Number(m) - 1]} ${Number(d)}, ${y}`;
}

const DRIVER = "J. Doe · JD"; // driver name · initials (placeholder)

function clock(iso: string): string {
  const dt = new Date(iso);
  return `${String(dt.getUTCHours()).padStart(2, "0")}:${String(dt.getUTCMinutes()).padStart(2, "0")}`;
}

function statusLabel(status: DutyStatus): string {
  return ROWS.find((r) => r.key === status)?.label.replace(/^\d+\.\s*/, "") ?? status;
}

export function EldLogSheet({ day, dayNumber, totalDays, bare = false }: EldLogSheetProps) {
  const points = buildPoints(day.segments, day.date);
  const remarks = day.segments
    .filter((s) => REMARK_NOTES.has(s.note))
    .map((s) => {
      const x1 = LEFT + fracHour(s.start, day.date) * HOUR_W;
      const x2 = LEFT + fracHour(s.end, day.date) * HOUR_W;
      return { x1, x2: Math.max(x2, x1 + 6), text: s.location || s.note };
    });

  // Per-day fields only. The fixed identification fields (carrier, vehicle,
  // co-driver, shipper, certification) are shown once for the whole trip in
  // <CarrierInfoCard>, not repeated on every sheet.
  const header = (
    <div className="mb-3 grid grid-cols-2 gap-x-6 gap-y-3 rounded-lg border border-border bg-muted/30 p-3 text-xs sm:grid-cols-4">
      <Field label="Date">{fmtDate(day.date)}</Field>
      <Field label="Total miles driving today">{Math.round(day.driving_miles)}</Field>
      <Field label="Driver">{DRIVER}</Field>
      <Field label="Log">Day {dayNumber} of {totalDays}</Field>
    </div>
  );

  const svg = (
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full min-w-[760px]"
        role="img"
        aria-label={`ELD log for ${day.date}`}
      >
        {/* Row background bands */}
        {ROWS.map((r, i) => (
          <rect
            key={`band${r.key}`}
            x={LEFT}
            y={TOP + i * ROW_H}
            width={GRID_W}
            height={ROW_H}
            fill="hsl(var(--muted))"
            opacity={i % 2 === 0 ? 0.22 : 0.1}
          />
        ))}

        {/* Hour columns: minor 15-min ticks + major hour lines + labels */}
        {Array.from({ length: 24 }).map((_, h) => {
          const x = LEFT + h * HOUR_W;
          return (
            <g key={`q${h}`}>
              {[1, 2, 3].map((q) => (
                <line
                  key={q}
                  x1={x + (q * HOUR_W) / 4}
                  y1={TOP}
                  x2={x + (q * HOUR_W) / 4}
                  y2={TOP + GRID_H}
                  stroke="hsl(var(--border))"
                  strokeWidth={0.4}
                  opacity={0.35}
                />
              ))}
            </g>
          );
        })}
        {Array.from({ length: 25 }).map((_, h) => {
          const x = LEFT + h * HOUR_W;
          return (
            <g key={`h${h}`}>
              <line x1={x} y1={TOP} x2={x} y2={TOP + GRID_H} stroke="hsl(var(--border))" strokeWidth={1} opacity={0.9} />
              <text x={x} y={TOP - 9} fontSize={9} textAnchor="middle" fill="hsl(var(--muted-foreground))">
                {hourLabel(h)}
              </text>
            </g>
          );
        })}

        {/* Rows: separators, labels, totals */}
        {ROWS.map((r, i) => {
          const yTop = TOP + i * ROW_H;
          return (
            <g key={r.key}>
              <line x1={LEFT} y1={yTop} x2={LEFT + GRID_W} y2={yTop} stroke="hsl(var(--border))" strokeWidth={1} />
              <text x={10} y={yTop + ROW_H / 2 + 3.5} fontSize={10} fill="hsl(var(--foreground))">
                {r.label}
              </text>
              <text
                x={LEFT + GRID_W + 14}
                y={yTop + ROW_H / 2 + 3.5}
                fontSize={11}
                fill="hsl(var(--accent))"
                fontWeight={700}
              >
                {fmtHrs(day.totals[r.key] ?? 0)}
              </text>
            </g>
          );
        })}
        {/* Outer grid border */}
        <rect
          x={LEFT}
          y={TOP}
          width={GRID_W}
          height={GRID_H}
          fill="none"
          stroke="hsl(var(--border))"
          strokeWidth={1.4}
        />

        {/* Totals header */}
        <text x={LEFT + GRID_W + 14} y={TOP - 9} fontSize={9} fill="hsl(var(--muted-foreground))">
          Total
        </text>

        {/* Duty-status line */}
        <polyline
          points={points}
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth={2.6}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Invisible hover targets per segment → native tooltip with the period */}
        {day.segments.map((s, i) => {
          const x1 = LEFT + fracHour(s.start, day.date) * HOUR_W;
          const x2 = LEFT + fracHour(s.end, day.date) * HOUR_W;
          if (x2 - x1 < 0.5) return null;
          const y = rowY(s.status);
          const extra = s.note && s.note !== "Driving" && s.note !== "Off duty" ? ` · ${s.note}` : "";
          const loc = s.location ? ` · ${s.location}` : "";
          const hrs = (new Date(s.end).getTime() - new Date(s.start).getTime()) / 3_600_000;
          return (
            <line
              key={`hit${i}`}
              x1={x1}
              y1={y}
              x2={x2}
              y2={y}
              stroke="transparent"
              strokeWidth={14}
              style={{ pointerEvents: "stroke", cursor: "help" }}
            >
              <title>
                {`${statusLabel(s.status)}  ${clock(s.start)}–${clock(s.end)}  (${fmtHrs(hrs)}h)${extra}${loc}`}
              </title>
            </line>
          );
        })}

        {/* Remarks */}
        <text x={10} y={TOP + GRID_H + 20} fontSize={10} fill="hsl(var(--foreground))" fontWeight={600}>
          Remarks
        </text>
        {remarks.map((r, i) => {
          const top = TOP + GRID_H;
          const mid = (r.x1 + r.x2) / 2;
          return (
            <g key={`r${i}`}>
              {/* DOT-style bracket spanning the event start -> end */}
              <polyline
                points={`${r.x1},${top} ${r.x1},${top + 8} ${r.x2},${top + 8} ${r.x2},${top}`}
                fill="none"
                stroke="hsl(var(--muted-foreground))"
                strokeWidth={0.8}
                opacity={0.8}
              />
              {/* Drop line from the middle of the bracket to the label */}
              <line
                x1={mid}
                y1={top + 8}
                x2={mid}
                y2={top + 16}
                stroke="hsl(var(--muted-foreground))"
                strokeWidth={0.8}
                opacity={0.8}
              />
              <text
                x={mid}
                y={top + 18}
                fontSize={7.5}
                textAnchor="end"
                fill="hsl(var(--muted-foreground))"
                transform={`rotate(-45 ${mid} ${top + 18})`}
              >
                {r.text.length > 22 ? r.text.slice(0, 21) + "…" : r.text}
              </text>
            </g>
          );
        })}
      </svg>
  );

  if (bare) {
    return (
      <div>
        {header}
        <div className="overflow-x-auto">{svg}</div>
      </div>
    );
  }

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between px-1">
        <h3 className="text-sm font-semibold">
          Driver&apos;s Daily Log — Day {dayNumber} of {totalDays}
        </h3>
        <span className="text-xs text-muted-foreground">{day.date} · 24h (UTC)</span>
      </div>
      {header}
      <div className="overflow-x-auto">{svg}</div>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] uppercase leading-normal tracking-wide text-muted-foreground">{label}</div>
      <div className="font-medium leading-normal text-foreground [overflow-wrap:anywhere]">{children}</div>
    </div>
  );
}
