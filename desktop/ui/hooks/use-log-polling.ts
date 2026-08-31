import { useRef } from "react";
import { callDesktop } from "../api.ts";
import type { CodingLogEntry } from "../types.ts";
import type { AppStore } from "./use-app-store.tsx";

type MatchState = { logs: string[]; viewerUrl: string; running: boolean };
type CodingAgentState = { logs: CodingLogEntry[]; versionDir: string };

export function useLogPolling(
  store: AppStore,
  source: { reloadSource(versionPath: string): Promise<void> },
  chat: { scroll(force?: boolean): void },
  match: { scrollLogs(): void },
) {
  const completedIdsRef = useRef(new Set<string | number>());
  const { updateChat, updateMatch } = store.getState();

  return async function pollLogs() {
    try {
      const [matchState, codingAgentState] = await Promise.all([
        callDesktop<MatchState>("getMatchLogs"),
        callDesktop<CodingAgentState>("getCodingAgentLogs"),
      ]);
      const current = store.getState();
      let viewerStates = current.viewerStates;
      let viewerUrl = current.viewerUrl;
      if (matchState.viewerUrl) {
        const versionPath = current.matchVersion || current.selected;
        if (versionPath) {
          const viewerState = viewerStates[versionPath] || { url: "", open: false };
          viewerStates = {
            ...viewerStates,
            [versionPath]: { ...viewerState, url: matchState.viewerUrl },
          };
          if (versionPath === current.selected) viewerUrl = matchState.viewerUrl;
        }
      }
      const codingLogs = codingAgentState.versionDir === current.selected
        ? codingAgentState.logs
        : [];
      const completedIds = new Set(
        codingLogs
          .filter((log) => log.title === "ファイル変更" && log.status === "completed")
          .map((log) => log.id),
      );
      const sourceChanged = [...completedIds].some((id) => !completedIdsRef.current.has(id));
      completedIdsRef.current = completedIds;
      updateMatch({
        matchLogs: matchState.logs,
        matchRunning: matchState.running,
        viewerStates,
        viewerUrl,
      });
      updateChat({ codingLogs });
      if (sourceChanged && current.selected) await source.reloadSource(current.selected);
      if (current.tab === "match") match.scrollLogs();
      if (current.busy) chat.scroll();
    } catch {
      // Desktop終了中などの一時的な取得失敗は次回のポーリングで回復する。
    }
  };
}
