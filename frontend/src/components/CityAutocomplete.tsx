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
  required?: boolean;
}

const PAGE = 20; // results per fetch; grows as the user scrolls

export function CityAutocomplete({ id, label, icon, value, onChange, onSelect, placeholder, required }: CityAutocompleteProps) {
  const [results, setResults] = React.useState<Place[]>([]);
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [active, setActive] = React.useState(-1);
  const [size, setSize] = React.useState(PAGE);
  const justSelected = React.useRef(false);
  const boxRef = React.useRef<HTMLDivElement>(null);

  const query = value.trim();
  const canSearch = query.length >= 2;

  // Debounced live fetch — re-runs on new query or when "size" grows (load more).
  React.useEffect(() => {
    if (justSelected.current) {
      justSelected.current = false;
      return;
    }
    if (!canSearch) {
      setResults([]);
      setLoading(false);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    const t = setTimeout(async () => {
      const r = await suggestPlaces(value, size, ctrl.signal);
      setResults(r);
      setActive(-1);
      setLoading(false);
    }, 280);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [value, size, canSearch]);

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

  function onScroll(e: React.UIEvent<HTMLUListElement>) {
    const el = e.currentTarget;
    const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 24;
    // Only ask for more if the last page came back full (likely more available).
    if (nearBottom && !loading && results.length >= size) {
      setSize((s) => s + PAGE);
    }
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
        {required && <span className="text-destructive">*</span>}
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
            setSize(PAGE); // reset paging for the new query
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>

      {open && (
        <ul
          className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-border bg-card p-1 shadow-2xl"
          role="listbox"
          onScroll={onScroll}
        >
          {!canSearch && (
            <li className="px-3 py-2 text-sm text-muted-foreground">Type at least 2 characters…</li>
          )}
          {canSearch && results.length === 0 && loading && (
            <li className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Searching…
            </li>
          )}
          {canSearch && results.length === 0 && !loading && (
            <li className="px-3 py-2 text-sm text-muted-foreground">No results found</li>
          )}
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
          {results.length > 0 && loading && (
            <li className="flex items-center justify-center gap-2 px-3 py-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading more…
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
