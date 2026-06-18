import { Clock, Download, Gauge, Moon, Route, Sun, Truck } from "lucide-react";
import * as React from "react";

import { DaySelector, type DaySelection } from "@/components/DaySelector";
import { EldLogSheet } from "@/components/EldLogSheet";
import { RouteMap } from "@/components/RouteMap";
import { TripForm } from "@/components/TripForm";
import { ViolationBanner } from "@/components/ViolationBanner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { createTrip } from "@/lib/api";
import { toggleTheme, useTheme } from "@/lib/theme";
import type { TripInput, TripResult } from "@/lib/types";

export function TripDashboard() {
  const [result, setResult] = React.useState<TripResult | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [exporting, setExporting] = React.useState(false);
  const [daySel, setDaySel] = React.useState<DaySelection>(0);
  const logsRef = React.useRef<HTMLDivElement>(null);
  const theme = useTheme();

  async function handleSubmit(input: TripInput) {
    setLoading(true);
    setError("");
    try {
      const res = await createTrip(input);
      setResult(res);
      setDaySel(0); // reset to the first day for a new trip
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to plan trip.");
    } finally {
      setLoading(false);
    }
  }

  async function exportPdf() {
    if (!logsRef.current || !result) return;
    setExporting(true);
    try {
      const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
        import("jspdf"),
        import("html2canvas"),
      ]);
      const bg = theme === "dark" ? "#0b1020" : "#ffffff";
      const canvas = await html2canvas(logsRef.current, { backgroundColor: bg, scale: 2 });
      const img = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
      const pageW = pdf.internal.pageSize.getWidth();
      const imgH = (canvas.height * pageW) / canvas.width;
      let remaining = imgH;
      let position = 0;
      const pageH = pdf.internal.pageSize.getHeight();
      pdf.addImage(img, "PNG", 0, position, pageW, imgH);
      remaining -= pageH;
      while (remaining > 0) {
        position -= pageH;
        pdf.addPage();
        pdf.addImage(img, "PNG", 0, position, pageW, imgH);
        remaining -= pageH;
      }
      pdf.save(`eld-logs-trip-${result.id}.pdf`);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-8 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/20 text-primary">
          <Truck className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">ELD Trip Planner</h1>
          <p className="text-sm text-muted-foreground">
            Route, stops &amp; FMCSA-compliant daily log sheets
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="ml-auto"
          onClick={toggleTheme}
          aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
      </header>

      {/* SECTION 1 — Trip input + route map */}
      <section className="mb-10">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          1 · Route &amp; Stops
        </h2>
        <div className="grid items-stretch gap-6 lg:grid-cols-[360px_1fr]">
          <div className="flex flex-col gap-4">
            <TripForm onSubmit={handleSubmit} loading={loading} className="flex-1" />
            {error && (
              <Card>
                <CardContent className="pt-5 text-sm text-destructive">{error}</CardContent>
              </Card>
            )}
          </div>

          <div className="space-y-4">
            {result ? (
              <>
                <div className="grid grid-cols-3 gap-3">
                  <Stat icon={<Gauge className="h-4 w-4" />} label="Distance" value={`${Math.round(result.route.distance_miles)} mi`} />
                  <Stat icon={<Clock className="h-4 w-4" />} label="Drive time" value={`${result.route.duration_hours.toFixed(1)} h`} />
                  <Stat icon={<Route className="h-4 w-4" />} label="Log days" value={`${result.days.length}`} />
                </div>
                <RouteMap result={result} />
              </>
            ) : (
              <Card>
                <CardContent className="flex h-[420px] flex-col items-center justify-center gap-3 text-center text-muted-foreground">
                  <Route className="h-10 w-10 opacity-40" />
                  <p>Enter trip details to see the route and daily logs.</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </section>

      {/* SECTION 2 — Daily logs */}
      {result && (
        <section>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              2 · Daily Logs <span className="normal-case text-foreground">({result.days.length} days)</span>
            </h2>
            <Button variant="outline" size="sm" onClick={exportPdf} disabled={exporting}>
              <Download className="h-4 w-4" />
              {exporting ? "Exporting…" : "Export PDF"}
            </Button>
          </div>

          <ViolationBanner violations={result.violations} />

          <div className="mt-3">
            <DaySelector days={result.days} selected={daySel} onSelect={setDaySel} />
          </div>

          <div className="mt-4 space-y-4">
            {daySel === "all"
              ? result.days.map((day, i) => (
                  <EldLogSheet key={i} day={day} dayNumber={i + 1} totalDays={result.days.length} />
                ))
              : (
                <EldLogSheet
                  day={result.days[daySel]}
                  dayNumber={daySel + 1}
                  totalDays={result.days.length}
                />
              )}
          </div>

          {/* Off-screen full render used only for PDF export (always all days) */}
          <div
            ref={logsRef}
            aria-hidden
            style={{ position: "absolute", left: -10000, top: 0, width: 840 }}
          >
            {result.days.map((day, i) => (
              <EldLogSheet key={i} day={day} dayNumber={i + 1} totalDays={result.days.length} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1 p-4">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {icon}
          {label}
        </span>
        <span className="text-xl font-bold">{value}</span>
      </CardContent>
    </Card>
  );
}
