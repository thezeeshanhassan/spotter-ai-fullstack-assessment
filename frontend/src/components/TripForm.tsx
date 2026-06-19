import { Loader2, MapPin, Navigation, PackageCheck, Timer } from "lucide-react";
import * as React from "react";

import { CityAutocomplete } from "@/components/CityAutocomplete";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Place, TripInput } from "@/lib/types";
import { cn } from "@/lib/utils";

interface TripFormProps {
  onSubmit: (input: TripInput) => void;
  loading: boolean;
  className?: string;
}

const ICONS = {
  current: <Navigation className="h-4 w-4 text-accent" />,
  pickup: <MapPin className="h-4 w-4 text-accent" />,
  dropoff: <PackageCheck className="h-4 w-4 text-accent" />,
  cycle: <Timer className="h-4 w-4 text-accent" />,
};

export function TripForm({ onSubmit, loading, className }: TripFormProps) {
  const [current, setCurrent] = React.useState("");
  const [pickup, setPickup] = React.useState("");
  const [dropoff, setDropoff] = React.useState("");
  const [currentPlace, setCurrentPlace] = React.useState<Place | null>(null);
  const [pickupPlace, setPickupPlace] = React.useState<Place | null>(null);
  const [dropoffPlace, setDropoffPlace] = React.useState<Place | null>(null);
  const [cycle, setCycle] = React.useState("0");
  const [error, setError] = React.useState("");

  // All three locations must be picked from search before the form can submit.
  const allPicked = Boolean(currentPlace && pickupPlace && dropoffPlace);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const cycleNum = cycle.trim() === "" ? 0 : Number(cycle); // cycle is optional → 0

    // Each location must be chosen from the search suggestions so we have a
    // verified place (and its coordinates) — free-typed text is rejected.
    const unpicked = [
      !currentPlace && "Current location",
      !pickupPlace && "Pickup location",
      !dropoffPlace && "Dropoff location",
    ].filter(Boolean) as string[];
    if (unpicked.length) {
      setError(`Select ${unpicked.join(", ")} from the search suggestions.`);
      return;
    }
    if (Number.isNaN(cycleNum) || cycleNum < 0 || cycleNum > 70) {
      setError("Cycle used must be between 0 and 70 hours.");
      return;
    }
    setError("");
    onSubmit({
      current_location: currentPlace!.label,
      pickup_location: pickupPlace!.label,
      dropoff_location: dropoffPlace!.label,
      cycle_used_hrs: cycleNum,
      current_lat: currentPlace!.lat,
      current_lng: currentPlace!.lng,
      pickup_lat: pickupPlace!.lat,
      pickup_lng: pickupPlace!.lng,
      dropoff_lat: dropoffPlace!.lat,
      dropoff_lng: dropoffPlace!.lng,
    });
  }

  return (
    <Card className={cn("flex flex-col", className)}>
      <CardHeader>
        <CardTitle>Plan a trip</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">
        <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-4">
          <CityAutocomplete id="current" label="Current location" icon={ICONS.current} required
            value={current} onChange={setCurrent} onSelect={setCurrentPlace} placeholder="Search a city…" />
          <CityAutocomplete id="pickup" label="Pickup location" icon={ICONS.pickup} required
            value={pickup} onChange={setPickup} onSelect={setPickupPlace} placeholder="Search a city…" />
          <CityAutocomplete id="dropoff" label="Dropoff location" icon={ICONS.dropoff} required
            value={dropoff} onChange={setDropoff} onSelect={setDropoffPlace} placeholder="Search a city…" />
          <Field id="cycle" label="Cycle used (hrs) — optional" icon={ICONS.cycle}
            value={cycle} onChange={setCycle} type="number" placeholder="0" />

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" size="lg" className="mt-auto w-full" disabled={loading || !allPicked}>
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
