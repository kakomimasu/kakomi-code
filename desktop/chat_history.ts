import { dirname } from "@std/path";
import { CHAT_HISTORY_LIMITS, type ChatHistory } from "./shared/chat-history.ts";

export type { ChatHistory, ChatMessage } from "./shared/chat-history.ts";
export const MAX_CHAT_HISTORY_FILE_BYTES = 64 * 1024 * 1024;

export function validateChatHistory(value: unknown): ChatHistory {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("チャット履歴が不正です。");
  }
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length > CHAT_HISTORY_LIMITS.versions) {
    throw new Error("チャット履歴の件数が多すぎます。");
  }
  let totalCharacters = 0;
  const history: ChatHistory = Object.create(null);
  for (const [versionName, messages] of entries) {
    if (
      !versionName || versionName.length > 200 || versionName === "__proto__" ||
      !Array.isArray(messages) || messages.length > CHAT_HISTORY_LIMITS.messagesPerVersion
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
      if (totalCharacters > CHAT_HISTORY_LIMITS.totalCharacters) {
        throw new Error("チャット履歴が大きすぎます。");
      }
      return { role, text };
    });
  }
  return history;
}

export async function loadChatHistory(file: string): Promise<ChatHistory> {
  try {
    const stat = await Deno.stat(file);
    if (!stat.isFile || stat.size > MAX_CHAT_HISTORY_FILE_BYTES) return {};
    return validateChatHistory(JSON.parse(await Deno.readTextFile(file)));
  } catch {
    return {};
  }
}

export async function saveChatHistory(file: string, value: unknown) {
  const history = validateChatHistory(value);
  const content = new TextEncoder().encode(JSON.stringify(history, null, 2) + "\n");
  if (content.byteLength > MAX_CHAT_HISTORY_FILE_BYTES) {
    throw new Error("チャット履歴のファイルが大きすぎます。");
  }
  const directory = dirname(file);
  await Deno.mkdir(directory, { recursive: true });
  const temporary = await Deno.makeTempFile({
    dir: directory,
    prefix: ".chat-history-",
    suffix: ".tmp",
  });
  try {
    await Deno.writeFile(temporary, content);
    await Deno.rename(temporary, file);
  } catch (error) {
    await Deno.remove(temporary).catch(() => {});
    throw error;
  }
}
