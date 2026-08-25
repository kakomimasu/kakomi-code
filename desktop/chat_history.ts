import { dirname } from "@std/path";

export type ChatMessage = { role: "user" | "assistant"; text: string };
export type ChatHistory = Record<string, ChatMessage[]>;

export function validateChatHistory(value: unknown): ChatHistory {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("チャット履歴が不正です。");
  }
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length > 200) throw new Error("チャット履歴の件数が多すぎます。");
  let totalCharacters = 0;
  const history: ChatHistory = Object.create(null);
  for (const [versionName, messages] of entries) {
    if (
      !versionName || versionName.length > 200 || versionName === "__proto__" ||
      !Array.isArray(messages) || messages.length > 1_000
    ) {
      throw new Error("チャット履歴が不正です。");
    }
    history[versionName] = messages.map((message) => {
      if (!message || typeof message !== "object") throw new Error("チャット履歴が不正です。");
      const { role, text } = message as Record<string, unknown>;
      if ((role !== "user" && role !== "assistant") || typeof text !== "string") {
        throw new Error("チャット履歴が不正です。");
      }
      totalCharacters += text.length;
      if (totalCharacters > 10_000_000) throw new Error("チャット履歴が大きすぎます。");
      return { role, text };
    });
  }
  return history;
}

export async function loadChatHistory(file: string): Promise<ChatHistory> {
  try {
    return validateChatHistory(JSON.parse(await Deno.readTextFile(file)));
  } catch {
    return {};
  }
}

export async function saveChatHistory(file: string, value: unknown) {
  const history = validateChatHistory(value);
  const directory = dirname(file);
  await Deno.mkdir(directory, { recursive: true });
  const temporary = await Deno.makeTempFile({
    dir: directory,
    prefix: ".chat-history-",
    suffix: ".tmp",
  });
  try {
    await Deno.writeTextFile(temporary, JSON.stringify(history, null, 2) + "\n");
    await Deno.rename(temporary, file);
  } catch (error) {
    await Deno.remove(temporary).catch(() => {});
    throw error;
  }
}
