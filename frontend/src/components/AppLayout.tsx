import { Info, Moon, Sun, Truck, User } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import type { AppPage } from "@/lib/router";
import { cn } from "@/lib/utils";
import { toggleTheme, useTheme } from "@/lib/theme";

interface AppLayoutProps {
  page: AppPage;
  onNavigate: (page: AppPage) => void;
  children: React.ReactNode;
}

export function AppLayout({ page, onNavigate, children }: AppLayoutProps) {
  const theme = useTheme();

  return (
    <div className="mx-auto min-h-full max-w-6xl px-4 py-8">
      <header className="mb-8 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => onNavigate("home")}
          className="flex items-center gap-3 text-left"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/20 text-primary">
            <Truck className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">ELD Trip Planner</h1>
            <p className="text-sm text-muted-foreground">
              Route, stops &amp; FMCSA-compliant daily log sheets
            </p>
          </div>
        </button>

        <nav className="ml-auto flex items-center gap-1">
          <NavTab active={page === "home"} onClick={() => onNavigate("home")}>
            Plan Trip
          </NavTab>
          <NavTab active={page === "about"} onClick={() => onNavigate("about")}>
            <Info className="h-4 w-4" />
            About
          </NavTab>
          <NavTab active={page === "developer"} onClick={() => onNavigate("developer")}>
            <User className="h-4 w-4" />
            Developer
          </NavTab>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="ml-1"
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </nav>
      </header>

      {children}
    </div>
  );
}

function NavTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-primary/20 text-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
