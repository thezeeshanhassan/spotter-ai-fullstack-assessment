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
const LEFT = 150;
const TOP = 26;
const HOUR_W = 26;
const GRID_W = HOUR_W * 24; // 624
const ROW_H = 30;
const GRID_H = ROW_H * 4;
const RIGHT = 60;
const WIDTH = LEFT + GRID_W + RIGHT;
const HEIGHT = TOP + GRID_H + 64;

function fracHour(iso: string, dayDate: string): number {
  const midnight = new Date(`${dayDate}T00:00:00Z`).getTime();
  const h = (new Date(iso).getTime() - midnight) / 3_600_000;
  return Math.max(0, Math.min(24, h));
}

function rowY(status: DutyStatus): number {
  const idx = ROWS.findIndex((r) => r.key === status);
  return TOP + idx * ROW_H + ROW_H / 2;
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

function fmtHrs(h: number): string {
  return (Math.round(h * 100) / 100).toString();
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
      <div className="mb-2 flex items-center justify-between px-1">
        <h3 className="text-sm font-semibold">
          Driver&apos;s Daily Log — Day {dayNumber} of {totalDays}
        </h3>
        <span className="text-xs text-muted-foreground">{day.date} (24h, UTC)</span>
      </div>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full min-w-[680px]"
        role="img"
        aria-label={`ELD log for ${day.date}`}
      >
        {/* Hour labels + vertical gridlines */}
        {Array.from({ length: 25 }).map((_, h) => {
          const x = LEFT + h * HOUR_W;
          const major = h % 3 === 0;
          return (
            <g key={`h${h}`}>
              <line
                x1={x} y1={TOP} x2={x} y2={TOP + GRID_H}
                stroke="hsl(var(--border))"
                strokeWidth={major ? 1 : 0.5}
                opacity={major ? 0.9 : 0.4}
              />
              {h < 24 && (
                <text x={x + 1} y={TOP - 8} fontSize={8} fill="hsl(var(--muted-foreground))">
                  {h === 0 ? "Mid" : h === 12 ? "Noon" : h}
                </text>
              )}
            </g>
          );
        })}

        {/* Rows: horizontal lines + labels */}
        {ROWS.map((r, i) => {
          const y = TOP + i * ROW_H;
          return (
            <g key={r.key}>
              <line x1={LEFT} y1={y} x2={LEFT + GRID_W} y2={y} stroke="hsl(var(--border))" strokeWidth={1} />
              <text x={8} y={y + ROW_H / 2 + 3} fontSize={9} fill="hsl(var(--foreground))">
                {r.label}
              </text>
              <text
                x={LEFT + GRID_W + 12}
                y={y + ROW_H / 2 + 3}
                fontSize={10}
                fill="hsl(var(--accent))"
                fontWeight={600}
              >
                {fmtHrs(day.totals[r.key] ?? 0)}
              </text>
            </g>
          );
        })}
        <line
          x1={LEFT} y1={TOP + GRID_H} x2={LEFT + GRID_W} y2={TOP + GRID_H}
          stroke="hsl(var(--border))" strokeWidth={1}
        />

        {/* Duty-status line */}
        <polyline
          points={points}
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth={2.2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Totals header */}
        <text x={LEFT + GRID_W + 12} y={TOP - 8} fontSize={8} fill="hsl(var(--muted-foreground))">
          Hrs
        </text>

        {/* Remarks */}
        <text x={8} y={TOP + GRID_H + 22} fontSize={9} fill="hsl(var(--muted-foreground))">
          Remarks:
        </text>
        {remarks.map((r, i) => (
          <g key={`r${i}`}>
            <line
              x1={r.x} y1={TOP + GRID_H} x2={r.x} y2={TOP + GRID_H + 10}
              stroke="hsl(var(--muted-foreground))" strokeWidth={0.5} opacity={0.6}
            />
            <text
              x={r.x} y={TOP + GRID_H + 22 + (i % 3) * 11}
              fontSize={7} fill="hsl(var(--muted-foreground))"
              transform={`rotate(0 ${r.x} ${TOP + GRID_H + 22})`}
            >
              {r.text.length > 16 ? r.text.slice(0, 15) + "…" : r.text}
            </text>
          </g>
        ))}
      </svg>
    </Card>
  );
}
