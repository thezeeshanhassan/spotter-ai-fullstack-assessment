import { Card, CardContent } from "@/components/ui/card";

// Fixed DOT identification fields — the same for the whole trip, so shown once
// (carrier / vehicle / co-driver / shipper are placeholders; not modeled data).
const FIELDS: { label: string; value: string }[] = [
  { label: "Carrier", value: "ELD Trip Planner Logistics" },
  { label: "Main office", value: "Dispatch HQ" },
  { label: "Truck / Trailer #", value: "TRK-001 / TRL-001" },
  { label: "Co-driver", value: "N/A" },
  { label: "Shipper / Commodity", value: "N/A · General freight" },
  { label: "Certification", value: "Entries true & correct" },
];

export function CarrierInfoCard() {
  return (
    <Card>
      <CardContent className="grid grid-cols-2 gap-x-6 gap-y-3 p-4 text-xs sm:grid-cols-3 lg:grid-cols-6">
        {FIELDS.map((f) => (
          <div key={f.label} className="min-w-0">
            <div className="text-[10px] uppercase leading-normal tracking-wide text-muted-foreground">
              {f.label}
            </div>
            <div className="font-medium leading-normal text-foreground [overflow-wrap:anywhere]">
              {f.value}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
