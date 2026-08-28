import { useEffect, useRef } from "react";
import { callDesktop } from "../api.ts";
import { BOARD_PREVIEWS, MODEL_OPTIONS, PRACTICE_OPPONENTS } from "../data.ts";
import type { KakomiApp, UtilityTab } from "../types.ts";
import { displayVersionName, errorMessage, nextFrame } from "./helpers.ts";
import { useAppState } from "./use-app-state.ts";
import { useChat } from "./use-chat.ts";
import { useColorScheme } from "./use-color-scheme.ts";
import { useDashboard } from "./use-dashboard.ts";
import { useLogPolling } from "./use-log-polling.ts";
import { useMatch } from "./use-match.ts";
import { usePaneResize } from "./use-pane-resize.ts";
import { useSourceEditor } from "./use-source-editor.ts";

export function useKakomiApp(): KakomiApp {
  const store = useAppState();
  const darkMode = useColorScheme();
  const paneResize = usePaneResize();
  const chatFeedRef = useRef<HTMLDivElement>(null);
  const matchOutputRef = useRef<HTMLPreElement>(null);
  const sourceEditorRef = useRef<HTMLDivElement>(null);
  const source = useSourceEditor(store, sourceEditorRef, darkMode);
  const chat = useChat(store, chatFeedRef, source);
  const match = useMatch(store, matchOutputRef, chat.scroll);
  const dashboard = useDashboard(store, source, chat);
  const pollLogs = useLogPolling(store, source, chat, match);

  async function fitWindowToScreen() {
    if (!globalThis.screen) return;
    const browserScreen = globalThis.screen as Screen & { availLeft?: number; availTop?: number };
    try {
      await callDesktop("fitWindowToScreen", [{
        width: browserScreen.availWidth,
        height: browserScreen.availHeight,
        x: browserScreen.availLeft || 0,
        y: browserScreen.availTop || 0,
      }]);
    } catch {
      // 画面情報を取得できない環境ではBrowserWindowの初期サイズを使う。
    }
  }

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;
    void (async () => {
      try {
        await fitWindowToScreen();
        await nextFrame();
        await dashboard.refresh();
        await chat.loadHistory();
        await source.loadSource();
        await pollLogs();
        if (!cancelled) timer = setInterval(() => void pollLogs(), 1000);
      } catch (error) {
        if (!cancelled) store.update({ status: `エラー: ${errorMessage(error)}` });
      }
    })();
    return () => {
      cancelled = true;
      if (timer !== undefined) clearInterval(timer);
    };
  }, []);

  async function selectTab(tab: UtilityTab) {
    await dashboard.selectTab(tab);
    if (tab === "match") match.scrollLogs();
  }

  const state = store.state;
  const messages = state.selected ? state.messagesByVersion[state.selected] || [] : [];
  const finalMessage = state.codingAgentResult?.versionDir === state.selected
    ? { role: "assistant" as const, text: state.codingAgentResult.text }
    : null;
  const finalLogIndex = finalMessage
    ? state.codingLogs.findLastIndex(
      (log) => log.kind === "message" && log.text === finalMessage.text,
    )
    : -1;
  const displayedCodingLogs = finalLogIndex < 0
    ? state.codingLogs
    : state.codingLogs.filter((_, index) => index !== finalLogIndex);

  return {
    dashboard: state.dashboard,
    selected: state.selected,
    tab: state.tab,
    agent: state.agent,
    model: state.models[state.agent] || "",
    modelOptions: MODEL_OPTIONS[state.agent],
    messages,
    messagesBeforeCodingLogs: finalMessage ? messages.slice(0, -1) : messages,
    displayedCodingLogs,
    codingAgentFinalMessage: finalMessage,
    matchLogs: state.matchLogs,
    idea: state.idea,
    status: state.status,
    matchStatus: state.matchStatus,
    matchRunning: state.matchRunning,
    viewerUrl: state.viewerUrl,
    viewerOpen: state.viewerOpen,
    viewerLoading: state.viewerLoading,
    ai: state.ai,
    board: state.board,
    darkMode,
    busy: state.busy,
    codingAgentRunning: state.codingAgentRunning,
    stopping: state.stopping,
    sidebarWidth: paneResize.sidebarWidth,
    utilityWidth: paneResize.utilityWidth,
    boardOptions: Object.values(BOARD_PREVIEWS),
    opponentOptions: Object.values(PRACTICE_OPPONENTS),
    selectedOpponent: PRACTICE_OPPONENTS[state.ai] || PRACTICE_OPPONENTS.a1,
    selectedBoard: BOARD_PREVIEWS[state.board] || BOARD_PREVIEWS["A-1"],
    sourceStatus: state.sourceStatus,
    chatFeedRef,
    matchOutputRef,
    sourceEditorRef,
    startResize: paneResize.startResize,
    startUtilityResize: paneResize.startUtilityResize,
    setIdea: chat.setIdea,
    setModel: chat.setModel,
    setAi: match.setAi,
    setBoard: match.setBoard,
    setViewerLoading: match.setViewerLoading,
    displayName: displayVersionName,
    codingLogStatus: (status) =>
      ({
        in_progress: "実行中",
        completed: "完了",
        failed: "失敗",
        declined: "拒否",
      })[status || ""] || status || "",
    closeOtherCodingTools: chat.closeOtherTools,
    boardPointColor: (point) => {
      const strength = (darkMode ? 0.3 : 0.16) +
        Math.min(Math.abs(point) / 16, 1) * (darkMode ? 0.58 : 0.72);
      if (point < 0) return `rgba(218, 80, 61, ${strength})`;
      if (point > 0) return `rgba(48, 133, 104, ${strength})`;
      return darkMode ? "#3b3b37" : "#e7e7e2";
    },
    selectAgent: chat.selectAgent,
    saveModel: chat.saveModel,
    clearChat: chat.clear,
    selectVersion: dashboard.selectVersion,
    selectTab,
    createVersion: dashboard.createVersion,
    renameVersion: dashboard.renameVersion,
    deleteVersion: dashboard.deleteVersion,
    startComposition: chat.startComposition,
    endComposition: chat.endComposition,
    clearCompositionGuard: chat.clearCompositionGuard,
    sendOnEnter: chat.sendOnEnter,
    improve: chat.improve,
    cancelImprove: chat.cancelImprove,
    saveSource: source.saveSource,
    startMatch: match.startMatch,
    openViewer: match.openViewer,
    closeViewer: match.closeViewer,
    updateChatScrollState: chat.updateScrollState,
  };
}
