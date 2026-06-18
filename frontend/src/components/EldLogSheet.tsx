import { Card } from "@/components/ui/card";
import type { DayLog, DutyStatus, Segment } from "@/lib/types";

interface EldLogSheetProps {
  day: DayLog;
  dayNumber: number;
  totalDays: number;
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

export function EldLogSheet({ day, dayNumber, totalDays }: EldLogSheetProps) {
  const points = buildPoints(day.segments, day.date);
  const remarks = day.segments
    .filter((s) => s.location || s.note)
    .map((s) => ({
      x: LEFT + fracHour(s.start, day.date) * HOUR_W,
      text: s.location || s.note,
    }));

  return (
    <Card className="overflow-x-auto p-4">
      <div className="mb-3 flex items-center justify-between px-1">
        <h3 className="text-sm font-semibold">
          Driver&apos;s Daily Log — Day {dayNumber} of {totalDays}
        </h3>
        <span className="text-xs text-muted-foreground">{day.date} · 24h (UTC)</span>
      </div>
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

        {/* Remarks */}
        <text x={10} y={TOP + GRID_H + 20} fontSize={10} fill="hsl(var(--foreground))" fontWeight={600}>
          Remarks
        </text>
        {remarks.map((r, i) => (
          <g key={`r${i}`}>
            <line
              x1={r.x}
              y1={TOP + GRID_H}
              x2={r.x}
              y2={TOP + GRID_H + 12}
              stroke="hsl(var(--muted-foreground))"
              strokeWidth={0.6}
              opacity={0.7}
            />
            <text
              x={r.x + 2}
              y={TOP + GRID_H + 16}
              fontSize={7.5}
              fill="hsl(var(--muted-foreground))"
              transform={`rotate(45 ${r.x + 2} ${TOP + GRID_H + 16})`}
            >
              {r.text.length > 22 ? r.text.slice(0, 21) + "…" : r.text}
            </text>
          </g>
        ))}
      </svg>
    </Card>
  );
}
