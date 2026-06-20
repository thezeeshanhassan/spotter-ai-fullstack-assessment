import { BookOpen, MapPin, ScrollText, Sparkles, X } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";

const STORAGE_KEY = "eld-welcome-seen";

interface WelcomeModalProps {
  /** Called when the user chooses to read the full overview (About page). */
  onReadOverview: () => void;
}

export function WelcomeModal({ onReadOverview }: WelcomeModalProps) {
  const [open, setOpen] = React.useState(() => {
    if (typeof localStorage === "undefined") return false;
    return !localStorage.getItem(STORAGE_KEY);
  });

  const dismiss = React.useCallback(() => {
    if (typeof localStorage !== "undefined") localStorage.setItem(STORAGE_KEY, "1");
    setOpen(false);
  }, []);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && dismiss();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, dismiss]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[3000] grid place-items-center bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-title"
      onClick={dismiss}
    >
      <div
        className="relative w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={dismiss}
          aria-label="Close"
          className="absolute right-4 top-4 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/20 text-primary">
            <Sparkles className="h-6 w-6" />
          </div>
          <div>
            <h2 id="welcome-title" className="text-xl font-bold tracking-tight">
              Welcome to ELD Trip Planner
            </h2>
            <p className="text-sm text-muted-foreground">FMCSA-compliant trip & log generator</p>
          </div>
        </div>

        <p className="text-sm leading-relaxed text-muted-foreground">
          Enter a trip — current location, pickup, dropoff, and cycle hours used — and the app
          plans a legal route and draws the daily log sheets a trucker would file.
        </p>

        <ul className="mt-4 space-y-2 text-sm">
          <Feature icon={<MapPin className="h-4 w-4 text-accent" />}>
            Route map with required fuel, break, and rest stops + animated playback
          </Feature>
          <Feature icon={<ScrollText className="h-4 w-4 text-accent" />}>
            DOT-style daily log sheets — one per day, exportable to PDF
          </Feature>
          <Feature icon={<BookOpen className="h-4 w-4 text-accent" />}>
            Full Hours-of-Service rules (11h, 14h, 70h cycle, 34h restart)
          </Feature>
        </ul>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            className="flex-1"
            onClick={() => {
              dismiss();
              onReadOverview();
            }}
          >
            <BookOpen className="h-4 w-4" />
            Read the overview
          </Button>
          <Button type="button" variant="outline" className="flex-1" onClick={dismiss}>
            Start planning
          </Button>
        </div>

        <p className="mt-3 text-center text-xs text-muted-foreground">
          You can reopen this anytime from the <span className="font-medium text-foreground">About</span> page.
        </p>
      </div>
    </div>
  );
}

function Feature({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5 text-muted-foreground">
      <span className="mt-0.5 shrink-0">{icon}</span>
      <span>{children}</span>
    </li>
  );
}
