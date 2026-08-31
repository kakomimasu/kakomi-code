import { callDesktop } from "../api.ts";
import { createChatHistoryPayload, limitMessagesByVersion } from "../chat-history.ts";
import type { DialogActions } from "../dialogs.tsx";
import type { Message } from "../types.ts";
import type { AppStore } from "./use-app-store.tsx";

export function useChatHistory(
  store: AppStore,
  dialogs: DialogActions,
  scroll: (force?: boolean) => void,
) {
  const { updateChat, updateShell } = store.getState();

  function currentMessages() {
    const current = store.getState();
    return current.selected ? current.messagesByVersion[current.selected] || [] : [];
  }

  function payload() {
    const current = store.getState();
    return createChatHistoryPayload(
      current.dashboard,
      current.messagesByVersion,
      current.selected,
    );
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
    updateChat({
      messagesByVersion: limitMessagesByVersion(
        current.dashboard,
        messagesByVersion,
        current.selected,
      ),
    });
  }

  async function persistHistory() {
    try {
      await callDesktop("saveChatHistory", [payload()]);
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
    updateChat({ messagesByVersion });
    const saved = await persistHistory();
    updateShell({
      status: saved ? "チャット履歴をクリアしました。" : "チャット履歴を保存できませんでした。",
    });
    scroll(true);
  }

  return { loadHistory, persistHistory, clear };
}
