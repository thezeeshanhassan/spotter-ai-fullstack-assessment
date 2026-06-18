import { Loader2 } from "lucide-react";
import * as React from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { suggestPlaces } from "@/lib/api";
import type { Place } from "@/lib/types";
import { cn } from "@/lib/utils";

interface CityAutocompleteProps {
  id: string;
  label: string;
  icon: React.ReactNode;
  value: string;
  onChange: (value: string) => void;
  /** Fires with the picked place, or null when the user edits the text freely. */
  onSelect?: (place: Place | null) => void;
  placeholder?: string;
}

export function CityAutocomplete({ id, label, icon, value, onChange, onSelect, placeholder }: CityAutocompleteProps) {
  const [results, setResults] = React.useState<Place[]>([]);
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [active, setActive] = React.useState(-1);
  const justSelected = React.useRef(false);
  const boxRef = React.useRef<HTMLDivElement>(null);

  // Debounced suggestion fetch.
  React.useEffect(() => {
    if (justSelected.current) {
      justSelected.current = false;
      return;
    }
    if (value.trim().length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    const t = setTimeout(async () => {
      const r = await suggestPlaces(value, ctrl.signal);
      setResults(r);
      setOpen(r.length > 0);
      setActive(-1);
      setLoading(false);
    }, 280);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [value]);

  // Close on outside click.
  React.useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function select(place: Place) {
    justSelected.current = true;
    onChange(place.label);
    onSelect?.(place);
    setOpen(false);
    setResults([]);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(results.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter" && active >= 0) {
      e.preventDefault();
      select(results[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="relative space-y-1.5" ref={boxRef}>
      <Label htmlFor={id} className="flex items-center gap-2">
        {icon}
        {label}
      </Label>
      <div className="relative">
        <Input
          id={id}
          value={value}
          placeholder={placeholder}
          autoComplete="off"
          onChange={(e) => {
            onChange(e.target.value);
            onSelect?.(null); // typing invalidates any prior pick
          }}
          onFocus={() => results.length > 0 && setOpen(true)}
          onKeyDown={onKeyDown}
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>

      {open && results.length > 0 && (
        <ul
          className="glass absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-lg p-1 shadow-xl"
          role="listbox"
        >
          {results.map((p, i) => (
            <li key={`${p.label}-${i}`} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseEnter={() => setActive(i)}
                onClick={() => select(p)}
                className={cn(
                  "w-full rounded-md px-3 py-2 text-left text-sm",
                  i === active ? "bg-primary/20 text-foreground" : "hover:bg-muted",
                )}
              >
                {p.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
