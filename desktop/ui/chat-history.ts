import { CHAT_HISTORY_LIMITS } from "../shared/chat-history.ts";
import type { Dashboard, Message, MessagesByVersion } from "./types.ts";

export { CHAT_HISTORY_LIMITS } from "../shared/chat-history.ts";

function prioritizedVersions(dashboard: Dashboard, preferredPath: string) {
  const versions = [...dashboard.versions].reverse();
  const preferred = versions.find((version) => version.path === preferredPath);
  return preferred
    ? [preferred, ...versions.filter((version) => version.path !== preferredPath)]
    : versions;
}

function recentMessages(messages: Message[], characterBudget: number): Message[] {
  const candidates = messages.slice(-CHAT_HISTORY_LIMITS.messagesPerVersion);
  let firstIncluded = candidates.length;
  let characters = 0;
  for (let index = candidates.length - 1; index >= 0; index--) {
    const nextCharacters = characters + candidates[index].text.length;
    if (nextCharacters > characterBudget) break;
    characters = nextCharacters;
    firstIncluded = index;
  }
  return candidates.slice(firstIncluded);
}

export function limitMessagesByVersion(
  dashboard: Dashboard,
  messagesByVersion: MessagesByVersion,
  preferredPath: string,
): MessagesByVersion {
  const limited: MessagesByVersion = {};
  let remainingCharacters = CHAT_HISTORY_LIMITS.totalCharacters;
  let versionCount = 0;

  for (const version of prioritizedVersions(dashboard, preferredPath)) {
    if (versionCount >= CHAT_HISTORY_LIMITS.versions || remainingCharacters <= 0) break;
    const messages = recentMessages(messagesByVersion[version.path] || [], remainingCharacters);
    if (messages.length === 0) continue;
    limited[version.path] = messages;
    remainingCharacters -= messages.reduce((total, message) => total + message.text.length, 0);
    versionCount++;
  }
  return limited;
}

export function createChatHistoryPayload(
  dashboard: Dashboard,
  messagesByVersion: MessagesByVersion,
  preferredPath: string,
): Record<string, Message[]> {
  const limited = limitMessagesByVersion(dashboard, messagesByVersion, preferredPath);
  return Object.fromEntries(
    dashboard.versions.flatMap((version) => {
      const messages = limited[version.path];
      return messages?.length ? [[version.name, messages] as const] : [];
    }),
  );
}
