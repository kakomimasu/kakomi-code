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

Deno.test("存在しない、または壊れたチャット履歴は空として読み込む", async () => {
  const directory = await Deno.makeTempDir();
  try {
    assertEquals(await loadChatHistory(`${directory}/missing.json`), {});

    const malformed = `${directory}/malformed.json`;
    await Deno.writeTextFile(malformed, "{not-json");
    assertEquals(await loadChatHistory(malformed), {});

    const invalid = `${directory}/invalid.json`;
    await Deno.writeTextFile(invalid, JSON.stringify({ version: [{ role: "system", text: "x" }] }));
    assertEquals(await loadChatHistory(invalid), {});
  } finally {
    await Deno.remove(directory, { recursive: true });
  }
});

Deno.test("チャット履歴はプロトタイプ汚染につながるキーを拒否する", () => {
  const history = JSON.parse('{"__proto__":[]}');
  assertThrows(() => validateChatHistory(history), Error, "チャット履歴が不正です。");
});

Deno.test("チャット履歴の版数とメッセージ数に上限を設ける", () => {
  const tooManyVersions = Object.fromEntries(
    Array.from({ length: 201 }, (_, index) => [`v${index}`, []]),
  );
  assertThrows(
    () => validateChatHistory(tooManyVersions),
    Error,
    "チャット履歴の件数が多すぎます。",
  );

  const tooManyMessages = Array.from(
    { length: 1_001 },
    () => ({ role: "user" as const, text: "x" }),
  );
  assertThrows(
    () => validateChatHistory({ version: tooManyMessages }),
    Error,
    "チャット履歴が不正です。",
  );
});

Deno.test("検証済みチャット履歴は通常のオブジェクトから分離する", () => {
  const history = validateChatHistory({ version: [{ role: "user", text: "作戦" }] });
  assertEquals(Object.getPrototypeOf(history), null);
  assertEquals(history.version, [{ role: "user", text: "作戦" }]);
});

Deno.test("チャット履歴の一時ファイルを保存後に残さない", async () => {
  const directory = await Deno.makeTempDir();
  const file = `${directory}/chat-history.json`;
  try {
    await saveChatHistory(file, { "v001-Alpha": [] });
    await saveChatHistory(file, {
      "v001-Alpha": [{ role: "user", text: "更新後" }],
    });

    assertEquals(await loadChatHistory(file), {
      "v001-Alpha": [{ role: "user", text: "更新後" }],
    });
    assertEquals(Array.from(Deno.readDirSync(directory), (entry) => entry.name), [
      "chat-history.json",
    ]);
  } finally {
    await Deno.remove(directory, { recursive: true });
  }
});
