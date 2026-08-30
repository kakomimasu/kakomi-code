import { type KeyboardEvent, type RefObject, type SyntheticEvent, useRef } from "react";
import { callDesktop } from "../api.ts";
import { createChatHistoryPayload, limitMessagesByVersion } from "../chat-history.ts";
import type { DialogActions } from "../dialogs.tsx";
import type { CodingAgent, Message } from "../types.ts";
import { errorMessage, nextFrame } from "./helpers.ts";
import { type AppStore, saveAgentPreference, saveModelPreferences } from "./use-app-state.ts";

export function useChat(
  store: AppStore,
  chatFeedRef: RefObject<HTMLDivElement | null>,
  source: {
    loadSource(versionPath?: string): Promise<void>;
    saveIfDirty(): Promise<boolean>;
  },
  dialogs: DialogActions,
) {
  const flags = useRef({
    autoScroll: true,
    composing: false,
    compositionGuardUntil: 0,
    improving: false,
  }).current;

  function currentMessages() {
    const current = store.getState();
    return current.selected ? current.messagesByVersion[current.selected] || [] : [];
  }

  function historyPayload() {
    const current = store.getState();
    return createChatHistoryPayload(
      current.dashboard,
      current.messagesByVersion,
      current.selected,
    );
  }

  function scroll(force = false) {
    void nextFrame(() => {
      const feed = chatFeedRef.current;
      if (!feed || (!force && !flags.autoScroll)) return;
      feed.scrollTop = feed.scrollHeight;
      flags.autoScroll = true;
    });
  }

  async function loadHistory() {
    const history = await callDesktop<Record<string, Message[]>>("getChatHistory");
    const current = store.getState();
    const messagesByVersion = Object.fromEntries(
      current.dashboard.versions.flatMap((version) => {
        const messages = history[version.name] || [];
        return messages.length ? [[version.path, messages] as const] : [];
      }),
    );
    store.setState({
      messagesByVersion: limitMessagesByVersion(
        current.dashboard,
        messagesByVersion,
        current.selected,
      ),
    });
  }

  async function persistHistory() {
    try {
      await callDesktop("saveChatHistory", [historyPayload()]);
      return true;
    } catch {
      return false;
    }
  }

  async function clear() {
    const current = store.getState();
    if (!current.selected || current.busy || currentMessages().length === 0) return;
    const confirmed = await dialogs.requestConfirmation({
      title: "チャット履歴をクリアしますか？",
      description: "このエージェントとのチャット履歴がすべて削除されます。元に戻せません。",
      confirmLabel: "クリア",
      danger: true,
    });
    if (!confirmed) return;
    const messagesByVersion = { ...current.messagesByVersion };
    delete messagesByVersion[current.selected];
    store.setState({ messagesByVersion });
    const saved = await persistHistory();
    store.setState({
      status: saved ? "チャット履歴をクリアしました。" : "チャット履歴を保存できませんでした。",
    });
    scroll(true);
  }

  async function improve() {
    const initial = store.getState();
    const idea = initial.idea.trim();
    if (!idea || !initial.selected || initial.busy || flags.improving) return;
    flags.improving = true;
    const versionDir = initial.selected;
    let started = false;
    try {
      if (!await source.saveIfDirty()) return;
      const current = store.getState();
      if (current.busy || current.selected !== versionDir) return;
      const pendingMessages = limitMessagesByVersion(
        current.dashboard,
        {
          ...current.messagesByVersion,
          [versionDir]: [
            ...(current.messagesByVersion[versionDir] || []),
            { role: "user", text: idea },
          ],
        },
        versionDir,
      );
      const messages = pendingMessages[versionDir] || [];
      store.setState({
        messagesByVersion: pendingMessages,
        idea: "",
        busy: true,
        codingAgentRunning: true,
        codingAgentResult: null,
        status: "AIを起動しています…",
      });
      started = true;
      scroll(true);
      await persistHistory();
      try {
        const active = store.getState();
        const result = await callDesktop<{ output: string; cancelled?: boolean }>(
          "improveWithAgent",
          [{ idea, versionDir, agent: active.agent, model: active.models[active.agent] || "" }],
        );
        const latest = store.getState();
        store.setState({
          messagesByVersion: limitMessagesByVersion(
            latest.dashboard,
            {
              ...latest.messagesByVersion,
              [versionDir]: [...messages, { role: "assistant", text: result.output }],
            },
            versionDir,
          ),
          codingAgentResult: { versionDir, text: result.output },
        });
        const saved = await persistHistory();
        store.setState({
          status: result.cancelled
            ? saved ? "改善を停止しました。" : "改善を停止しましたが、履歴を保存できませんでした。"
            : saved
            ? "改善が完了しました。"
            : "改善は完了しましたが、履歴を保存できませんでした。",
        });
      } catch (error) {
        const message = `エラー: ${errorMessage(error)}`;
        const latest = store.getState();
        store.setState({
          messagesByVersion: limitMessagesByVersion(
            latest.dashboard,
            {
              ...latest.messagesByVersion,
              [versionDir]: [...messages, { role: "assistant", text: message }],
            },
            versionDir,
          ),
          codingAgentResult: { versionDir, text: message },
        });
        const saved = await persistHistory();
        store.setState({
          status: message + (saved ? "" : "（チャット履歴も保存できませんでした）"),
        });
      }
    } finally {
      try {
        if (started) await source.loadSource(versionDir);
      } finally {
        flags.improving = false;
        if (started) {
          store.setState({ busy: false, codingAgentRunning: false });
          scroll();
        }
      }
    }
  }

  async function cancelImprove() {
    const current = store.getState();
    if (!current.codingAgentRunning || current.stopping) return;
    store.setState({ stopping: true, status: "コーディングAIの停止を要求しています…" });
    try {
      const result = await callDesktop<{ message: string }>("stopCodingAgent");
      if (store.getState().codingAgentRunning) store.setState({ status: result.message });
    } catch (error) {
      if (store.getState().codingAgentRunning) {
        store.setState({ status: `エラー: ${errorMessage(error)}` });
      }
    } finally {
      store.setState({ stopping: false });
    }
  }

  function sendOnEnter(event: KeyboardEvent<HTMLTextAreaElement>) {
    const duringComposition = flags.composing || event.nativeEvent.isComposing ||
      event.keyCode === 229 || event.key === "Process";
    if (event.key !== "Enter") return;
    if (event.shiftKey || duringComposition || performance.now() < flags.compositionGuardUntil) {
      return;
    }
    event.preventDefault();
    void improve();
  }

  function closeOtherTools(event: SyntheticEvent<HTMLDetailsElement>) {
    const openedTool = event.currentTarget;
    if (!openedTool.open) return;
    chatFeedRef.current?.querySelectorAll<HTMLDetailsElement>(".coding-log-tool[open]").forEach(
      (tool) => {
        if (tool !== openedTool) tool.open = false;
      },
    );
  }

  return {
    loadHistory,
    persistHistory,
    clear,
    improve,
    cancelImprove,
    scroll,
    closeOtherTools,
    updateScrollState() {
      const feed = chatFeedRef.current;
      if (!feed) return;
      flags.autoScroll = feed.scrollHeight - feed.clientHeight - feed.scrollTop <= 24;
    },
    startComposition() {
      flags.composing = true;
      flags.compositionGuardUntil = 0;
    },
    endComposition() {
      flags.composing = false;
      flags.compositionGuardUntil = performance.now() + 150;
    },
    clearCompositionGuard: () => flags.compositionGuardUntil = 0,
    sendOnEnter,
    setIdea: (idea: string) => store.setState({ idea }),
    selectAgent(agent: CodingAgent) {
      store.setState({ agent });
      saveAgentPreference(agent);
    },
    setModel(model: string) {
      store.setState((current) => ({ models: { ...current.models, [current.agent]: model } }));
    },
    saveModel() {
      const current = store.getState();
      const value = (current.models[current.agent] || "").trim();
      const model = value && !/^[A-Za-z0-9][A-Za-z0-9._:/~-]*$/.test(value) ? "" : value;
      const models = { ...current.models, [current.agent]: model };
      store.setState({ models });
      saveModelPreferences(models);
    },
  };
}
