import { useEffect, useState } from "react";

type MatchMedia = (query: string) => Pick<MediaQueryList, "matches">;

export function prefersDarkMode(matchMedia: MatchMedia | undefined = globalThis.matchMedia) {
  return typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: dark)").matches;
}

export function useColorScheme() {
  const [darkMode, setDarkMode] = useState(() => prefersDarkMode());

  useEffect(() => {
    if (typeof globalThis.matchMedia !== "function") return;
    const mediaQuery = globalThis.matchMedia("(prefers-color-scheme: dark)");
    const listener = (event: MediaQueryListEvent) => setDarkMode(event.matches);
    setDarkMode(mediaQuery.matches);
    mediaQuery.addEventListener("change", listener);
    return () => mediaQuery.removeEventListener("change", listener);
  }, []);

  return darkMode;
}
