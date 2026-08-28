import { type KeyboardEvent, type RefObject, type SyntheticEvent, useRef } from "react";
import { callDesktop } from "../api.ts";
import type { CodingAgent, Message } from "../types.ts";
import { errorMessage, nextFrame } from "./helpers.ts";
import { type AppStore, saveAgentPreference, saveModelPreferences } from "./use-app-state.ts";

export function useChat(
  store: AppStore,
  chatFeedRef: RefObject<HTMLDivElement | null>,
  source: { loadSource(versionPath?: string): Promise<void> },
) {
  const flags = useRef({
    autoScroll: true,
    composing: false,
    compositionGuardUntil: 0,
  }).current;

  function currentMessages() {
    const current = store.read();
    return current.selected ? current.messagesByVersion[current.selected] || [] : [];
  }

  function historyPayload() {
    const current = store.read();
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
    const current = store.read();
    store.update({
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
    const current = store.read();
    if (!current.selected || current.busy || currentMessages().length === 0) return;
    if (!confirm("このエージェントのチャット履歴をすべて削除しますか？")) return;
    store.update({ messagesByVersion: { ...current.messagesByVersion, [current.selected]: [] } });
    const saved = await persistHistory();
    store.update({
      status: saved ? "チャット履歴をクリアしました。" : "チャット履歴を保存できませんでした。",
    });
    scroll(true);
  }

  async function improve() {
    const current = store.read();
    const idea = current.idea.trim();
    if (!idea || !current.selected || current.busy) return;
    const versionDir = current.selected;
    const messages: Message[] = [
      ...(current.messagesByVersion[versionDir] || []),
      { role: "user", text: idea },
    ];
    store.update({ messagesByVersion: { ...current.messagesByVersion, [versionDir]: messages } });
    await persistHistory();
    store.update({
      idea: "",
      busy: true,
      codingAgentRunning: true,
      codingAgentResult: null,
      status: "AIを起動しています…",
    });
    scroll(true);
    try {
      const active = store.read();
      const result = await callDesktop<{ output: string; cancelled?: boolean }>(
        "improveWithAgent",
        [{ idea, versionDir, agent: active.agent, model: active.models[active.agent] || "" }],
      );
      const completedMessages: Message[] = [
        ...messages,
        { role: "assistant", text: result.output },
      ];
      store.update({
        messagesByVersion: {
          ...store.read().messagesByVersion,
          [versionDir]: completedMessages,
        },
        codingAgentResult: { versionDir, text: result.output },
      });
      const saved = await persistHistory();
      store.update({
        status: result.cancelled
          ? saved ? "改善を停止しました。" : "改善を停止しましたが、履歴を保存できませんでした。"
          : saved
          ? "改善が完了しました。"
          : "改善は完了しましたが、履歴を保存できませんでした。",
      });
    } catch (error) {
      const message = `エラー: ${errorMessage(error)}`;
      store.update({
        messagesByVersion: {
          ...store.read().messagesByVersion,
          [versionDir]: [...messages, { role: "assistant", text: message }],
        },
        codingAgentResult: { versionDir, text: message },
      });
      const saved = await persistHistory();
      store.update({
        status: message + (saved ? "" : "（チャット履歴も保存できませんでした）"),
      });
    } finally {
      await source.loadSource(versionDir);
      store.update({ busy: false, codingAgentRunning: false });
      scroll();
    }
  }

  async function cancelImprove() {
    const current = store.read();
    if (!current.codingAgentRunning || current.stopping) return;
    store.update({ stopping: true, status: "コーディングAIの停止を要求しています…" });
    try {
      const result = await callDesktop<{ message: string }>("stopCodingAgent");
      if (store.read().codingAgentRunning) store.update({ status: result.message });
    } catch (error) {
      if (store.read().codingAgentRunning) {
        store.update({ status: `エラー: ${errorMessage(error)}` });
      }
    } finally {
      store.update({ stopping: false });
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
    setIdea: (idea: string) => store.update({ idea }),
    selectAgent(agent: CodingAgent) {
      store.update({ agent });
      saveAgentPreference(agent);
    },
    setModel(model: string) {
      store.update((current) => ({ models: { ...current.models, [current.agent]: model } }));
    },
    saveModel() {
      const current = store.read();
      const value = (current.models[current.agent] || "").trim();
      const model = value && !/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(value) ? "" : value;
      const models = { ...current.models, [current.agent]: model };
      store.update({ models });
      saveModelPreferences(models);
    },
  };
}
