import * as React from "react";

export type AppPage = "home" | "about";

const PATHS: Record<AppPage, string> = {
  home: "/",
  about: "/about",
};

function pageFromPath(path: string): AppPage {
  return path === PATHS.about ? "about" : "home";
}

/** Minimal client router — works with Vercel SPA rewrites, no extra dependency. */
export function useAppRouter() {
  const [page, setPage] = React.useState<AppPage>(() => pageFromPath(window.location.pathname));

  React.useEffect(() => {
    const onPop = () => setPage(pageFromPath(window.location.pathname));
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const navigate = React.useCallback((next: AppPage) => {
    const path = PATHS[next];
    if (window.location.pathname !== path) {
      window.history.pushState({}, "", path);
    }
    setPage(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  return { page, navigate };
}
