import { useSyncExternalStore } from "react";

export type Theme = "dark" | "light";

const STORAGE_KEY = "eld-theme";
const listeners = new Set<() => void>();

function read(): Theme {
  if (typeof localStorage === "undefined") return "dark";
  return (localStorage.getItem(STORAGE_KEY) as Theme) || "dark";
}

let current: Theme = read();

function apply(theme: Theme) {
  if (typeof document !== "undefined") {
    document.documentElement.classList.toggle("light", theme === "light");
  }
}

apply(current);

export function setTheme(theme: Theme) {
  current = theme;
  if (typeof localStorage !== "undefined") localStorage.setItem(STORAGE_KEY, theme);
  apply(theme);
  listeners.forEach((l) => l());
}

export function toggleTheme() {
  setTheme(current === "dark" ? "light" : "dark");
}

export function useTheme(): Theme {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current,
    () => "dark",
  );
}
