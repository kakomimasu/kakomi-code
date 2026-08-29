import type { RefObject } from "react";
import { callDesktop } from "../api.ts";
import { isTrustedViewerUrl, saveViewerState } from "../viewer.ts";
import { displayVersionName, errorMessage, nextFrame } from "./helpers.ts";
import type { AppStore } from "./use-app-state.ts";

export function useMatch(
  store: AppStore,
  matchOutputRef: RefObject<HTMLPreElement | null>,
  scrollChat: (force?: boolean) => void,
  source: { saveIfDirty(): Promise<boolean> },
) {
  function scrollLogs() {
    void nextFrame(() => {
      const output = matchOutputRef.current;
      if (output) output.scrollTop = output.scrollHeight;
    });
  }

  async function startMatch() {
    const current = store.getState();
    if (!current.selected || current.busy) return;
    if (!await source.saveIfDirty()) return;
    const selectedVersion = current.dashboard.versions.find((version) =>
      version.path === current.selected
    );
    store.setState({
      matchVersion: current.selected,
      busy: true,
      matchStatus: "参加しています…",
      viewerOpen: false,
      viewerLoading: false,
      viewerUrl: "",
      viewerStates: saveViewerState(current.viewerStates, current.selected, "", false),
      matchLogs: [],
      matchRunning: true,
    });
    try {
      const result = await callDesktop<{ message: string; viewerUrl: string; stopped?: boolean }>(
        "startMatch",
        [{
          agentName: displayVersionName(selectedVersion?.name || "エルメマス"),
          aiName: current.ai,
          board: current.board,
          versionDir: current.selected,
        }],
      );
      const active = store.getState();
      store.setState({
        matchStatus: result.message,
        viewerUrl: result.viewerUrl,
        viewerStates: saveViewerState(
          active.viewerStates,
          active.selected,
          result.viewerUrl,
          active.viewerOpen,
        ),
        matchRunning: !result.stopped,
      });
    } catch (error) {
      store.setState({ matchStatus: `エラー: ${errorMessage(error)}` });
    } finally {
      store.setState({ busy: false });
      scrollLogs();
    }
  }

  async function stopMatch() {
    const current = store.getState();
    if (!current.matchRunning || current.matchStopping) return;
    store.setState({ matchStopping: true, matchStatus: "対戦を停止しています…" });
    try {
      const result = await callDesktop<{ message: string }>("stopMatch");
      store.setState({ matchStatus: result.message });
    } catch (error) {
      store.setState({ matchStatus: `エラー: ${errorMessage(error)}` });
    } finally {
      store.setState({ matchStopping: false });
    }
  }

  function openViewer() {
    const current = store.getState();
    if (!isTrustedViewerUrl(current.viewerUrl)) {
      store.setState({ matchStatus: "エラー: 対戦画面のURLを確認できませんでした。" });
      return;
    }
    store.setState({
      viewerLoading: true,
      viewerOpen: true,
      viewerStates: saveViewerState(
        current.viewerStates,
        current.selected,
        current.viewerUrl,
        true,
      ),
    });
  }

  function closeViewer() {
    const current = store.getState();
    store.setState({
      viewerOpen: false,
      viewerLoading: false,
      viewerStates: saveViewerState(
        current.viewerStates,
        current.selected,
        current.viewerUrl,
        false,
      ),
    });
    scrollChat(true);
  }

  return {
    startMatch,
    stopMatch,
    openViewer,
    closeViewer,
    scrollLogs,
    setAi: (ai: string) => store.setState({ ai }),
    setBoard: (board: string) => store.setState({ board }),
    setViewerLoading: (viewerLoading: boolean) => store.setState({ viewerLoading }),
  };
}
