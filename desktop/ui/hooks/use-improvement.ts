import { useRef } from "react";
import { callDesktop } from "../api.ts";
import { limitMessagesByVersion } from "../chat-history.ts";
import { errorMessage } from "./helpers.ts";
import type { AppStore } from "./use-app-state.ts";

export type ImprovementSourceActions = {
  loadSource(versionPath?: string): Promise<void>;
  saveIfDirty(): Promise<boolean>;
};

export function useImprovement(
  store: AppStore,
  source: ImprovementSourceActions,
  persistHistory: () => Promise<boolean>,
  scroll: (force?: boolean) => void,
) {
  const improving = useRef(false);

  async function improve() {
    const initial = store.getState();
    const idea = initial.idea.trim();
    if (!idea || !initial.selected || initial.busy || improving.current) return;
    improving.current = true;
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
        improving.current = false;
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

  return { improve, cancelImprove };
}
