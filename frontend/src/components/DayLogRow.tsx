import { ChevronDown } from "lucide-react";
import * as React from "react";

import { EldLogSheet } from "@/components/EldLogSheet";
import { cn } from "@/lib/utils";
import type { DayLog, DutyStatus } from "@/lib/types";

interface DayLogRowProps {
  day: DayLog;
  dayNumber: number;
  totalDays: number;
  defaultOpen?: boolean;
}

// Compliance badge from the day's driving hours (11h FMCSA limit).
function compliance(driving: number): { label: string; cls: string } {
  if (driving > 11.001) {
    return { label: "Over 11h", cls: "bg-destructive/15 text-destructive border-destructive/30" };
  }
  if (driving >= 10) {
    return { label: "Near 11h", cls: "bg-amber-500/15 text-amber-500 border-amber-500/30" };
  }
  return { label: "OK", cls: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30" };
}

const SPARK_W = 200;
const SPARK_H = 34;
const SPARK_ROWS: DutyStatus[] = ["off_duty", "sleeper", "driving", "on_duty"];

function Sparkline({ day }: { day: DayLog }) {
  const midnight = new Date(`${day.date}T00:00:00Z`).getTime();
  const frac = (iso: string) =>
    Math.max(0, Math.min(24, (new Date(iso).getTime() - midnight) / 3_600_000));
  const rowY = (s: DutyStatus) =>
    4 + SPARK_ROWS.indexOf(s) * ((SPARK_H - 8) / 3);
  const pts = day.segments
    .flatMap((s) => {
      const x1 = (frac(s.start) / 24) * SPARK_W;
      const x2 = (frac(s.end) / 24) * SPARK_W;
      const y = rowY(s.status);
      return [`${x1},${y}`, `${x2},${y}`];
    })
    .join(" ");
  return (
    <svg width={SPARK_W} height={SPARK_H} className="shrink-0" aria-hidden>
      <rect x={0} y={0} width={SPARK_W} height={SPARK_H} rx={4} fill="hsl(var(--muted))" opacity={0.3} />
      <polyline points={pts} fill="none" stroke="hsl(var(--primary))" strokeWidth={1.5} strokeLinejoin="round" />
    </svg>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="hidden text-right sm:block">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={cn("text-sm font-bold tabular-nums", accent && "text-primary")}>{value.toFixed(2)}</div>
    </div>
  );
}

export function DayLogRow({ day, dayNumber, totalDays, defaultOpen = false }: DayLogRowProps) {
  const [open, setOpen] = React.useState(defaultOpen);
  const t = day.totals;
  const badge = compliance(t.driving ?? 0);

  return (
    <div className="glass overflow-hidden rounded-xl">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-4 px-4 py-3 text-left transition-colors hover:bg-muted/40"
        aria-expanded={open}
      >
        <div className="w-24 shrink-0">
          <div className="text-sm font-semibold">
            Day {dayNumber} of {totalDays}
          </div>
          <div className="text-xs text-muted-foreground">{day.date}</div>
        </div>

        <Sparkline day={day} />

        <div className="ml-auto flex items-center gap-4">
          <Stat label="Drive" value={t.driving ?? 0} accent />
          <Stat label="On-Duty" value={t.on_duty ?? 0} />
          <Stat label="Off" value={t.off_duty ?? 0} />
          <Stat label="Sleep" value={t.sleeper ?? 0} />
          <span className={cn("rounded-full border px-2.5 py-0.5 text-xs font-medium", badge.cls)}>
            {badge.label}
          </span>
          <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} />
        </div>
      </button>

      {open && (
        <div className="border-t border-border px-4 py-4">
          <EldLogSheet day={day} dayNumber={dayNumber} totalDays={totalDays} bare />
          {(() => {
            const remarks = day.segments.filter((s) => s.location || s.note);
            return remarks.length ? (
              <p className="mt-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Remarks: </span>
                {remarks.map((s, i) => (
                  <span key={i}>
                    {i > 0 && " · "}
                    {s.location || s.note}
                  </span>
                ))}
              </p>
            ) : null;
          })()}
        </div>
      )}
    </div>
  );
}
