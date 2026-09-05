import { join } from "@std/path";
import {
  parseCreateVersionRequest,
  parseRenameVersionRequest,
  parseSaveSourceRequest,
  parseVersionDirectory,
} from "./api_requests.ts";
import { loadChatHistory, saveChatHistory } from "./chat_history.ts";
import type { ApiHandler } from "./local_server.ts";
import {
  createVersion,
  deleteVersion,
  listVersions,
  renameVersion,
  validateVersion,
} from "./version_manager.ts";

/** Native bindings and HTTP requests use the same validated file operations. */
export function createWorkspaceApi({ projectDir, chatHistoryFile }: {
  projectDir: string;
  chatHistoryFile: string;
}): Map<string, ApiHandler> {
  async function dashboard() {
    const versions = await listVersions(projectDir);
    return { projectDir, versions: versions.filter((version) => version.ready) };
  }

  return new Map<string, ApiHandler>([
    ["getDashboard", dashboard],
    ["getChatHistory", () => loadChatHistory(chatHistoryFile)],
    ["saveChatHistory", async (history) => {
      await saveChatHistory(chatHistoryFile, history);
      return { message: "チャット履歴を保存しました。" };
    }],
    ["getSource", async (versionDir) => {
      const target = await validateVersion(projectDir, parseVersionDirectory(versionDir));
      return await Deno.readTextFile(join(target, "main.ts"));
    }],
    ["saveSource", async (versionDir, source) => {
      const request = parseSaveSourceRequest(versionDir, source);
      const target = await validateVersion(projectDir, request.versionDir);
      await Deno.writeTextFile(join(target, "main.ts"), request.source);
      return { message: "main.tsを保存しました。" };
    }],
    ["createVersion", async (value) => {
      const request = parseCreateVersionRequest(value);
      const version = await createVersion(projectDir, request.agentName, request.sourceVersion);
      return { version, dashboard: await dashboard() };
    }],
    ["renameVersion", async (value) => {
      const request = parseRenameVersionRequest(value);
      const version = await renameVersion(projectDir, request.versionDir, request.agentName);
      return { version, dashboard: await dashboard() };
    }],
    ["deleteVersion", async (versionDir) => {
      await deleteVersion(projectDir, parseVersionDirectory(versionDir));
      return { versions: await listVersions(projectDir) };
    }],
  ]);
}
