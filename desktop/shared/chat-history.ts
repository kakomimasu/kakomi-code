export type ChatMessage = { role: "user" | "assistant"; text: string };
export type ChatHistory = Record<string, ChatMessage[]>;

export const CHAT_HISTORY_LIMITS = {
  versions: 200,
  messagesPerVersion: 1_000,
  totalCharacters: 10_000_000,
} as const;
