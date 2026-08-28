import type { ViewerState } from "./types.ts";

export function isTrustedViewerUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.origin === "https://kakomimasu.com" && url.pathname === "/game" &&
      Boolean(url.searchParams.get("id"));
  } catch {
    return false;
  }
}

export function saveViewerState(
  states: Record<string, ViewerState>,
  path: string,
  url: string,
  open: boolean,
): Record<string, ViewerState> {
  return path ? { ...states, [path]: { url, open } } : states;
}

export function loadViewerState(states: Record<string, ViewerState>, path: string): ViewerState {
  const state = states[path];
  return { url: state?.url || "", open: Boolean(state?.open && state.url) };
}
