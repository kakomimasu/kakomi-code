import { type KeyboardEvent, type RefObject, type SyntheticEvent, useRef } from "react";
import { callDesktop } from "../api.ts";
import type { DialogActions } from "../dialogs.tsx";
import type { CodingAgent, Message } from "../types.ts";
import { errorMessage, nextFrame } from "./helpers.ts";
import { type AppStore, saveAgentPreference, saveModelPreferences } from "./use-app-state.ts";

export function useChat(
  store: AppStore,
  chatFeedRef: RefObject<HTMLDivElement | null>,
  source: { loadSource(versionPath?: string): Promise<void> },
  dialogs: DialogActions,
) {
  const flags = useRef({
    autoScroll: true,
    composing: false,
    compositionGuardUntil: 0,
  }).current;

  function currentMessages() {
    const current = store.getState();
    return current.selected ? current.messagesByVersion[current.selected] || [] : [];
  }

  function historyPayload() {
    const current = store.getState();
    return Object.fromEntries(
      current.dashboard.versions.map((version) => [
        version.name,
        current.messagesByVersion[version.path] || [],
      ]),
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
    store.setState({
      messagesByVersion: Object.fromEntries(
        current.dashboard.versions.map((version) => [
          version.path,
          history[version.name] || [],
        ]),
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
    store.setState({ messagesByVersion: { ...current.messagesByVersion, [current.selected]: [] } });
    const saved = await persistHistory();
    store.setState({
      status: saved ? "チャット履歴をクリアしました。" : "チャット履歴を保存できませんでした。",
    });
    scroll(true);
  }

  async function improve() {
    const current = store.getState();
    const idea = current.idea.trim();
    if (!idea || !current.selected || current.busy) return;
    const versionDir = current.selected;
    const messages: Message[] = [
      ...(current.messagesByVersion[versionDir] || []),
      { role: "user", text: idea },
    ];
    store.setState({ messagesByVersion: { ...current.messagesByVersion, [versionDir]: messages } });
    await persistHistory();
    store.setState({
      idea: "",
      busy: true,
      codingAgentRunning: true,
      codingAgentResult: null,
      status: "AIを起動しています…",
    });
    scroll(true);
    try {
      const active = store.getState();
      const result = await callDesktop<{ output: string; cancelled?: boolean }>(
        "improveWithAgent",
        [{ idea, versionDir, agent: active.agent, model: active.models[active.agent] || "" }],
      );
      const completedMessages: Message[] = [
        ...messages,
        { role: "assistant", text: result.output },
      ];
      store.setState({
        messagesByVersion: {
          ...store.getState().messagesByVersion,
          [versionDir]: completedMessages,
        },
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
      store.setState({
        messagesByVersion: {
          ...store.getState().messagesByVersion,
          [versionDir]: [...messages, { role: "assistant", text: message }],
        },
        codingAgentResult: { versionDir, text: message },
      });
      const saved = await persistHistory();
      store.setState({
        status: message + (saved ? "" : "（チャット履歴も保存できませんでした）"),
      });
    } finally {
      await source.loadSource(versionDir);
      store.setState({ busy: false, codingAgentRunning: false });
      scroll();
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
      const model = value && !/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(value) ? "" : value;
      const models = { ...current.models, [current.agent]: model };
      store.setState({ models });
      saveModelPreferences(models);
    },
  };
}
