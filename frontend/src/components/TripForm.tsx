import { Loader2, MapPin, Navigation, PackageCheck, Timer } from "lucide-react";
import * as React from "react";

import { CityAutocomplete } from "@/components/CityAutocomplete";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { TripInput } from "@/lib/types";

interface TripFormProps {
  onSubmit: (input: TripInput) => void;
  loading: boolean;
}

const ICONS = {
  current: <Navigation className="h-4 w-4 text-accent" />,
  pickup: <MapPin className="h-4 w-4 text-accent" />,
  dropoff: <PackageCheck className="h-4 w-4 text-accent" />,
  cycle: <Timer className="h-4 w-4 text-accent" />,
};

export function TripForm({ onSubmit, loading }: TripFormProps) {
  const [current, setCurrent] = React.useState("");
  const [pickup, setPickup] = React.useState("");
  const [dropoff, setDropoff] = React.useState("");
  const [cycle, setCycle] = React.useState("0");
  const [error, setError] = React.useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const cycleNum = Number(cycle);
    if (!current.trim() || !pickup.trim() || !dropoff.trim()) {
      setError("All location fields are required.");
      return;
    }
    if (Number.isNaN(cycleNum) || cycleNum < 0 || cycleNum > 70) {
      setError("Cycle used must be between 0 and 70 hours.");
      return;
    }
    setError("");
    onSubmit({
      current_location: current.trim(),
      pickup_location: pickup.trim(),
      dropoff_location: dropoff.trim(),
      cycle_used_hrs: cycleNum,
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Plan a trip</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <CityAutocomplete id="current" label="Current location" icon={ICONS.current}
            value={current} onChange={setCurrent} placeholder="Search a city…" />
          <CityAutocomplete id="pickup" label="Pickup location" icon={ICONS.pickup}
            value={pickup} onChange={setPickup} placeholder="Search a city…" />
          <CityAutocomplete id="dropoff" label="Dropoff location" icon={ICONS.dropoff}
            value={dropoff} onChange={setDropoff} placeholder="Search a city…" />
          <Field id="cycle" label="Cycle used (hrs)" icon={ICONS.cycle}
            value={cycle} onChange={setCycle} type="number" placeholder="0" />

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" size="lg" className="w-full" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Planning…
              </>
            ) : (
              "Plan Trip & Draw Logs"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

interface FieldProps {
  id: string;
  label: string;
  icon: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}

function Field({ id, label, icon, value, onChange, type = "text", placeholder }: FieldProps) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="flex items-center gap-2">
        {icon}
        {label}
      </Label>
      <Input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        min={type === "number" ? 0 : undefined}
        max={type === "number" ? 70 : undefined}
        step={type === "number" ? "0.5" : undefined}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
