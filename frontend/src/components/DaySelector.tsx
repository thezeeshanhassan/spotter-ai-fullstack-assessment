import { ChevronLeft, ChevronRight } from "lucide-react";
import * as React from "react";

import type { DayLog } from "@/lib/types";
import { cn } from "@/lib/utils";

export type DaySelection = number | "all";

interface DaySelectorProps {
  days: DayLog[];
  selected: DaySelection;
  onSelect: (sel: DaySelection) => void;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function parts(date: string) {
  const [, m, d] = date.split("-");
  return { dom: d, mon: MONTHS[Number(m) - 1] ?? "" };
}

export function DaySelector({ days, selected, onSelect }: DaySelectorProps) {
  const scroller = React.useRef<HTMLDivElement>(null);
  const pills = React.useRef<(HTMLButtonElement | null)[]>([]);

  // Current numeric index ("all" acts as before-the-first so Next → day 1).
  const cur = selected === "all" ? -1 : selected;
  const prevDisabled = cur <= 0;
  const nextDisabled = cur >= days.length - 1;

  function go(index: number) {
    onSelect(index);
  }

  // Keep the selected pill in view when navigating.
  React.useEffect(() => {
    if (typeof selected === "number") {
      pills.current[selected]?.scrollIntoView?.({ behavior: "smooth", inline: "center", block: "nearest" });
    }
  }, [selected]);

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => !prevDisabled && go(cur - 1)}
        disabled={prevDisabled}
        aria-label="Previous day"
        className="grid h-12 w-9 shrink-0 place-items-center rounded-lg border border-border bg-muted/40 hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      <button
        type="button"
        onClick={() => onSelect("all")}
        className={cn(
          "h-12 shrink-0 rounded-lg border px-4 text-sm font-semibold transition-colors",
          selected === "all"
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border bg-muted/40 hover:bg-muted",
        )}
      >
        All
      </button>

      <div ref={scroller} className="flex gap-2 overflow-x-auto scroll-smooth py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {days.map((day, i) => {
          const { dom, mon } = parts(day.date);
          const sel = selected === i;
          return (
            <button
              key={i}
              ref={(el) => { pills.current[i] = el; }}
              type="button"
              onClick={() => onSelect(i)}
              aria-pressed={sel}
              className={cn(
                "flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-lg border transition-colors",
                sel
                  ? "border-primary bg-foreground text-background"
                  : "border-border bg-muted/40 hover:bg-muted",
              )}
              title={`Day ${i + 1} · ${day.date}`}
            >
              <span className={cn("text-[10px] leading-none", sel ? "opacity-70" : "text-muted-foreground")}>
                {mon} {dom}
              </span>
              <span className="text-sm font-bold leading-tight">{i + 1}</span>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => !nextDisabled && go(cur + 1)}
        disabled={nextDisabled}
        aria-label="Next day"
        className="grid h-12 w-9 shrink-0 place-items-center rounded-lg border border-border bg-muted/40 hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
