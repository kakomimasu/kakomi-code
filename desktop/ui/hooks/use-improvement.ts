import { useRef } from "react";
import { callDesktop } from "../api.ts";
import { limitMessagesByVersion } from "../chat-history.ts";
import type { Message } from "../types.ts";
import { errorMessage } from "./helpers.ts";
import type { AppStore } from "./use-app-store.tsx";

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
  const { updateChat, updateShell } = store.getState();

  function recordResult(versionDir: string, messages: Message[], text: string) {
    const current = store.getState();
    updateChat({
      messagesByVersion: limitMessagesByVersion(
        current.dashboard,
        {
          ...current.messagesByVersion,
          [versionDir]: [...messages, { role: "assistant", text }],
        },
        versionDir,
      ),
      codingAgentResult: { versionDir, text },
    });
    return persistHistory();
  }

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
      updateChat({
        messagesByVersion: pendingMessages,
        idea: "",
        codingAgentRunning: true,
        codingAgentResult: null,
      });
      updateShell({ busy: true, status: "AIを起動しています…" });
      started = true;
      scroll(true);
      await persistHistory();
      try {
        const active = store.getState();
        const result = await callDesktop<{ output: string; cancelled?: boolean }>(
          "improveWithAgent",
          [{ idea, versionDir, agent: active.agent, model: active.models[active.agent] || "" }],
        );
        const saved = await recordResult(versionDir, messages, result.output);
        updateShell({
          status: result.cancelled
            ? saved ? "改善を停止しました。" : "改善を停止しましたが、履歴を保存できませんでした。"
            : saved
            ? "改善が完了しました。"
            : "改善は完了しましたが、履歴を保存できませんでした。",
        });
      } catch (error) {
        const message = `エラー: ${errorMessage(error)}`;
        const saved = await recordResult(versionDir, messages, message);
        updateShell({
          status: message + (saved ? "" : "（チャット履歴も保存できませんでした）"),
        });
      }
    } finally {
      try {
        if (started) await source.loadSource(versionDir);
      } finally {
        improving.current = false;
        if (started) {
          updateShell({ busy: false });
          updateChat({ codingAgentRunning: false });
          scroll();
        }
      }
    }
  }

  async function cancelImprove() {
    const current = store.getState();
    if (!current.codingAgentRunning || current.stopping) return;
    updateChat({ stopping: true });
    updateShell({ status: "コーディングAIの停止を要求しています…" });
    try {
      const result = await callDesktop<{ message: string }>("stopCodingAgent");
      if (store.getState().codingAgentRunning) updateShell({ status: result.message });
    } catch (error) {
      if (store.getState().codingAgentRunning) {
        updateShell({ status: `エラー: ${errorMessage(error)}` });
      }
    } finally {
      updateChat({ stopping: false });
    }
  }

  return { improve, cancelImprove };
}
