import { assertEquals } from "@std/assert";
import { CHAT_HISTORY_LIMITS, createChatHistoryPayload } from "../desktop/ui/chat-history.ts";
import { createAppStore } from "../desktop/ui/hooks/use-app-state.ts";
import { canApplyLoadedSource } from "../desktop/ui/source-load.ts";

Deno.test("React用ストアは共有状態を更新して購読者へ通知する", () => {
  const originalLocalStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  try {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: { getItem: () => null, setItem: () => {} },
    });
    const store = createAppStore();
    const selectedValues: string[] = [];
    const unsubscribe = store.subscribe((state) => selectedValues.push(state.selected));

    store.setState({ selected: "versions/test-agent" });
    store.setState((state) => ({ busy: !state.busy }));

    assertEquals(store.getState().selected, "versions/test-agent");
    assertEquals(store.getState().busy, true);
    assertEquals(selectedValues, ["versions/test-agent", "versions/test-agent"]);
    unsubscribe();
  } finally {
    if (originalLocalStorage) {
      Object.defineProperty(globalThis, "localStorage", originalLocalStorage);
    } else {
      delete (globalThis as Record<string, unknown>).localStorage;
    }
  }
});

Deno.test("読み込み開始後の編集や古い応答でソースを上書きしない", () => {
  const current = {
    currentRequest: 2,
    currentRevision: 4,
    dirty: false,
    requestedRevision: 4,
    request: 2,
    selected: "versions/current",
    versionPath: "versions/current",
  };
  assertEquals(canApplyLoadedSource(current), true);
  assertEquals(canApplyLoadedSource({ ...current, dirty: true }), false);
  assertEquals(canApplyLoadedSource({ ...current, currentRevision: 5 }), false);
  assertEquals(canApplyLoadedSource({ ...current, currentRequest: 3 }), false);
  assertEquals(canApplyLoadedSource({ ...current, selected: "versions/other" }), false);
});

Deno.test("チャット履歴は空の版を除外して保存上限内に収める", () => {
  const versions = Array.from({ length: CHAT_HISTORY_LIMITS.versions + 2 }, (_, index) => ({
    path: `versions/agent-${index}`,
    name: `v${String(index + 1).padStart(3, "0")}-agent-${index}`,
  }));
  const messagesByVersion = Object.fromEntries(
    versions.map((version, index) => [
      version.path,
      index === 1 ? [] : [{ role: "user" as const, text: `idea-${index}` }],
    ]),
  );
  const preferred = versions[0];
  const payload = createChatHistoryPayload(
    { projectDir: "/project", versions },
    messagesByVersion,
    preferred.path,
  );

  assertEquals(Object.keys(payload).length, CHAT_HISTORY_LIMITS.versions);
  assertEquals(payload[preferred.name], [{ role: "user", text: "idea-0" }]);
  assertEquals(payload[versions[1].name], undefined);

  const overflowingMessages = Array.from(
    { length: CHAT_HISTORY_LIMITS.messagesPerVersion + 2 },
    (_, index) => ({ role: "user" as const, text: String(index) }),
  );
  const messageLimitedPayload = createChatHistoryPayload(
    { projectDir: "/project", versions: [preferred] },
    { [preferred.path]: overflowingMessages },
    preferred.path,
  );
  assertEquals(
    messageLimitedPayload[preferred.name].length,
    CHAT_HISTORY_LIMITS.messagesPerVersion,
  );
  assertEquals(messageLimitedPayload[preferred.name][0].text, "2");

  const millionCharacters = "x".repeat(1_000_000);
  const characterLimitedPayload = createChatHistoryPayload(
    { projectDir: "/project", versions: [preferred] },
    {
      [preferred.path]: Array.from({ length: 11 }, () => ({
        role: "assistant" as const,
        text: millionCharacters,
      })),
    },
    preferred.path,
  );
  assertEquals(characterLimitedPayload[preferred.name].length, 10);
});
