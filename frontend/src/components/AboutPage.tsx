import { AlertTriangle, BookOpen, MapPin, Scale, ShieldAlert } from "lucide-react";
import type { ReactNode } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const bold = "font-semibold text-foreground";

const HOS_RULES = [
  { rule: "11-hour driving limit", limit: "11 h", meaning: "After 11 hours of driving you must stop until a 10-hour off-duty reset." },
  { rule: "14-hour window", limit: "14 h", meaning: "No driving after the 14th hour following the start of your shift." },
  { rule: "30-minute break", limit: "After 8 h", meaning: "A break of at least 30 minutes is required after 8 cumulative hours of driving." },
  { rule: "10-hour reset", limit: "10 h", meaning: "10 consecutive off-duty hours restart the 11-hour and 14-hour clocks." },
  { rule: "70-hour / 8-day cycle", limit: "70 h", meaning: "Total on-duty time over the rolling 8-day window cannot exceed 70 hours." },
  { rule: "34-hour restart", limit: "34 h", meaning: "When the weekly cycle is exhausted, 34+ consecutive off-duty hours reset the cycle to zero." },
] as const;

const ASSUMPTIONS = [
  "Property-carrying commercial driver (not passenger-carrying).",
  "70-hour / 8-day schedule. No adverse-driving or short-haul exceptions.",
  "Fuel stop at least every 1,000 miles (30 minutes on duty, not driving).",
  "1 hour on duty for pickup and 1 hour on duty for dropoff.",
  "Route order is always: current location → pickup → dropoff.",
  "Rest periods are logged as Off Duty (sleeper-berth split is not modeled).",
] as const;

const LIMITATIONS: { title: string; body: ReactNode }[] = [
  {
    title: "Not legal advice",
    body: "This app is an educational planning tool for the Spotter AI assessment. It does not replace carrier policies, ELD hardware, or professional compliance review.",
  },
  {
    title: "Simplified weekly cycle",
    body: "The 70-hour limit is tracked as a running on-duty total seeded by your “cycle used” input, not a literal day-by-day rolling 8-day ledger. Behavior matches “cannot drive past 70 hours” for single-trip planning.",
  },
  {
    title: "No sleeper-berth split",
    body: "All rest is recorded as Off Duty. The Sleeper Berth row appears on the log grid (as on the real DOT form) but stays at zero.",
  },
  {
    title: "Route length cap",
    body: (
      <>
        OpenRouteService rejects some ultra-long routes when the path exceeds{" "}
        <strong className={bold}>~3,700 miles (6,000 km)</strong> per request. Very long
        cross-country zigzags may show a{" "}
        <strong className={bold}>“route too long”</strong> error instead of a plan. Try
        locations that are closer together. Longest routes that usually work are around{" "}
        <strong className={bold}>4,300 to 4,600 miles</strong>.
      </>
    ),
  },
  {
    title: "Trip start time",
    body: "Planning starts at the current time, so trips begun late in the day often cross midnight and produce more daily log sheets, even for relatively short drives.",
  },
  {
    title: "Placeholder log header fields",
    body: "Vehicle number, carrier name, shipper, and similar header fields on the log sheet are placeholders for display. They are not collected or stored.",
  },
  {
    title: "Location search required",
    body: "You must pick cities from the autocomplete dropdown. Free-typed text without a selection cannot be submitted, to avoid bad geocodes and impossible routes.",
  },
];

export function AboutPage() {
  return (
    <div className="space-y-6 pb-12">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-accent" />
            What this app does
          </CardTitle>
          <CardDescription>
            ELD stands for <strong>Electronic Logging Device</strong>, the system truck
            drivers use to record legal work hours. This app simulates that output.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm leading-relaxed text-muted-foreground">
          <p>
            Enter where a driver is now, where they pick up freight, where they drop off,
            and optionally how many on-duty hours they have already used this week. The
            app returns:
          </p>
          <ul className="list-inside list-disc space-y-1">
            <li>An interactive <strong className="text-foreground">route map</strong> with pickup, dropoff, fuel, breaks, and rest stops.</li>
            <li>
              <strong className="text-foreground">Daily log sheets</strong> drawn like the
              U.S. DOT (Department of Transportation) Record of Duty Status grid, one sheet
              per calendar day.
            </li>
          </ul>
          <p>
            Rules follow the FMCSA (Federal Motor Carrier Safety Administration){" "}
            <em>Hours of Service</em> guide for property-carrying drivers (49 CFR Part 395).
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5 text-accent" />
            Hours of Service rules enforced
          </CardTitle>
          <CardDescription>
            These limits are applied automatically when building the trip timeline.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="pb-2 pr-4 font-medium">Rule</th>
                <th className="pb-2 pr-4 font-medium">Limit</th>
                <th className="pb-2 font-medium">Plain meaning</th>
              </tr>
            </thead>
            <tbody className="text-muted-foreground">
              {HOS_RULES.map((row) => (
                <tr key={row.rule} className="border-b border-border/60">
                  <td className="py-2.5 pr-4 font-medium text-foreground">{row.rule}</td>
                  <td className="py-2.5 pr-4 whitespace-nowrap">{row.limit}</td>
                  <td className="py-2.5">{row.meaning}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-accent" />
            Trip inputs &amp; policies
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div>
            <h4 className="mb-1 font-medium text-foreground">Required fields</h4>
            <p className="text-muted-foreground">
              <strong>Current location</strong>, <strong>pickup location</strong>, and{" "}
              <strong>dropoff location</strong> (marked with <span className="text-destructive">*</span>)
              must be chosen from the city search dropdown. The submit button stays disabled
              until all three are selected.
            </p>
          </div>
          <div>
            <h4 className="mb-1 font-medium text-foreground">Cycle used (optional)</h4>
            <p className="text-muted-foreground">
              How many <strong>on-duty hours</strong> the driver has already worked in their
              current 70-hour / 8-day window before this trip. Leave empty or enter{" "}
              <strong>0</strong> for a fresh driver. Valid range: 0–70 hours. On-duty includes
              driving, pickup/dropoff, fuel stops, and breaks. Normal 10-hour off-duty rests do not count.
            </p>
          </div>
          <div>
            <h4 className="mb-1 font-medium text-foreground">Built-in assumptions</h4>
            <ul className="list-inside list-disc space-y-1 text-muted-foreground">
              {ASSUMPTIONS.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Violations &amp; warnings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            If a trip would exceed the <strong className="text-foreground">70-hour / 8-day</strong>{" "}
            on-duty limit, the app shows a red banner and automatically inserts a{" "}
            <strong className="text-foreground">34-hour off-duty restart</strong> so the
            schedule stays legal. This is expected on long hauls and is not a failure.
          </p>
          <p>
            The warning means the engine adjusted the plan to comply with federal rules. The
            restart appears on the map, on the daily logs as a long Off Duty block, and in
            PDF export.
          </p>
          <p>
            A single calendar day can legally contain more than 11 hours of driving if two
            shifts are separated by a 10-hour reset (“split shift”). Such days may be labeled
            informational. The engine always inserts required rest before limits are broken.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Daily log sheets: how days are counted</CardTitle>
          <CardDescription>There is no fixed minimum number of log days.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            The number of sheets equals the number of <strong className="text-foreground">calendar days</strong>{" "}
            the trip timeline spans (midnight to midnight). Each sheet is padded to exactly{" "}
            <strong className="text-foreground">24 hours</strong> with Off Duty time where needed,
            as required on real DOT logs.
          </p>
          <p>
            Trips with more than ~11 hours of driving almost always need a 10-hour reset, which
            pushes the timeline past midnight, so <strong className="text-foreground">2+ log days</strong>{" "}
            is common even for moderate trips. Long cross-country routes can produce 10+ sheets.
          </p>
        </CardContent>
      </Card>

      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-destructive" />
            Limitations &amp; disclaimers
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {LIMITATIONS.map((item) => (
            <div key={item.title}>
              <h4 className="text-sm font-semibold text-foreground">{item.title}</h4>
              <p className="mt-1 text-sm text-muted-foreground">{item.body}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <p className="text-center text-xs text-muted-foreground">
        Source: FMCSA Interstate Truck Driver&apos;s Guide to Hours of Service (49 CFR Part 395).
        Routing &amp; geocoding via OpenRouteService. Map tiles via OpenStreetMap / CARTO.
      </p>
    </div>
  );
}
