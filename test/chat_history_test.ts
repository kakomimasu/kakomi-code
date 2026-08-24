import { assertEquals, assertThrows } from "@std/assert";
import { loadChatHistory, saveChatHistory, validateChatHistory } from "../desktop/chat_history.ts";

Deno.test("チャット履歴を保存して次回起動時に読み込める", async () => {
  const directory = await Deno.makeTempDir();
  const file = `${directory}/settings/chat-history.json`;
  try {
    const history = {
      "v001-Alpha": [
        { role: "user" as const, text: "右へ進む" },
        { role: "assistant" as const, text: "改善しました" },
      ],
      "v002-Beta": [],
    };
    await saveChatHistory(file, history);
    assertEquals(await loadChatHistory(file), history);
  } finally {
    await Deno.remove(directory, { recursive: true });
  }
});

Deno.test("不正なチャット履歴は保存しない", () => {
  assertThrows(
    () => validateChatHistory({ "v001-Alpha": [{ role: "system", text: "x" }] }),
    Error,
    "チャット履歴が不正です。",
  );
});
