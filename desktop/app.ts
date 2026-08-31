import { join } from "@std/path";
import { applicationMenu } from "./application_menu.ts";
import { resolveProjectDirectory, resolveSettingsDir } from "./app_paths.ts";
import { loadChatHistory, saveChatHistory } from "./chat_history.ts";
import { CodingAgentController } from "./coding_agent_controller.ts";
import { type ApiHandler, createLocalRequestHandler } from "./local_server.ts";
import { MatchController } from "./match_controller.ts";
import { validateWindowGeometry } from "./window_geometry.ts";
import {
  createVersion,
  deleteVersion,
  initializeProject,
  listVersions,
  normalizeSourceVersion,
  renameVersion,
  validateVersion,
} from "./version_manager.ts";

const bundledTemplatePath = join(
  import.meta.dirname ?? "desktop",
  "..",
  "template",
  "main.ts",
);
const bundledConfigPath = join(
  import.meta.dirname ?? "desktop",
  "..",
  "template",
  "deno.json",
);
const settingsDir = resolveSettingsDir(Deno.env.toObject(), Deno.cwd());
const projectFile = join(settingsDir, "project-dir.txt");
const chatHistoryFile = join(settingsDir, "chat-history.json");
const apiToken = crypto.randomUUID();
const MAX_SOURCE_CHARACTERS = 1_000_000;

async function saveProjectDir(projectDir: string) {
  await Deno.mkdir(settingsDir, { recursive: true });
  await Deno.writeTextFile(projectFile, projectDir);
}

async function dashboard(projectDir: string) {
  const versions = await listVersions(projectDir);
  return {
    projectDir,
    versions: versions.filter((version) => version.ready),
  };
}

const projectDir = await resolveProjectDirectory({
  settingsDir,
  cwd: Deno.cwd(),
  executablePath: Deno.execPath(),
  bundledTemplatePath,
  bundledConfigPath,
});
await initializeProject(projectDir);
await saveProjectDir(projectDir);
// Deno Desktop exposes BrowserWindow at runtime, but the stable Deno type library
// does not include this experimental API yet.
// @ts-expect-error Deno Desktop experimental API
const window = new Deno.BrowserWindow({
  title: "囲みコード",
  width: 1440,
  height: 900,
});
window.setApplicationMenu(applicationMenu());
const codingAgentController = new CodingAgentController({
  projectDir,
  bundledConfigPath,
  maxSourceCharacters: MAX_SOURCE_CHARACTERS,
});
const matchController = new MatchController(projectDir, bundledConfigPath);

let shuttingDown = false;

async function shutdown(): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  try {
    await Promise.allSettled([
      codingAgentController.stopForShutdown(),
      matchController.stopForShutdown(),
    ]);
  } finally {
    Deno.exit(0);
  }
}

// Deno.serve keeps the runtime alive after the native window closes. Exit the
// process as well so the title-bar close button fully quits the desktop app.
window.addEventListener("close", () => {
  void shutdown();
});

const apiHandlers = new Map<string, ApiHandler>();
function expose(name: string, handler: ApiHandler) {
  apiHandlers.set(name, handler);
  window.bind(name, handler);
}

expose("fitWindowToScreen", (value: unknown) => {
  const geometry = validateWindowGeometry(value);
  window.setSize(geometry.width, geometry.height);
  window.setPosition(geometry.x, geometry.y);
  return geometry;
});
expose("getDashboard", () => dashboard(projectDir));
expose("getOpenCodeModels", () => codingAgentController.getOpenCodeModels());
expose("getChatHistory", () => loadChatHistory(chatHistoryFile));
expose("saveChatHistory", async (history: unknown) => {
  await saveChatHistory(chatHistoryFile, history);
  return { message: "チャット履歴を保存しました。" };
});
expose("getMatchLogs", () => matchController.getState());
expose("getCodingAgentLogs", () => codingAgentController.getState());
expose("stopCodingAgent", () => codingAgentController.stop());
expose("getSource", async (versionDir: unknown) => {
  if (typeof versionDir !== "string" || !versionDir) {
    throw new Error("バージョンを選択してください。");
  }
  const target = await validateVersion(projectDir, versionDir);
  return await Deno.readTextFile(join(target, "main.ts"));
});
expose("saveSource", async (versionDir: unknown, source: unknown) => {
  if (typeof versionDir !== "string" || !versionDir) {
    throw new Error("バージョンを選択してください。");
  }
  if (typeof source !== "string" || !source.trim() || source.length > MAX_SOURCE_CHARACTERS) {
    throw new Error("ソースは1〜1,000,000文字で入力してください。");
  }
  const target = await validateVersion(projectDir, versionDir);
  await Deno.writeTextFile(join(target, "main.ts"), source);
  return { message: "main.tsを保存しました。" };
});
expose("createVersion", async (label: unknown) => {
  const request = typeof label === "string"
    ? { agentName: label }
    : label as Record<string, unknown>;
  if (!request || typeof request.agentName !== "string" || !request.agentName.trim()) {
    throw new Error("AI名を入力してください。");
  }
  if (request.agentName.trim().length > 40) throw new Error("AI名は40文字以内で入力してください。");
  const sourceVersion = normalizeSourceVersion(request.sourceVersion);
  const version = await createVersion(projectDir, request.agentName, sourceVersion);
  return { version, dashboard: await dashboard(projectDir) };
});

expose("renameVersion", async (value: unknown) => {
  if (!value || typeof value !== "object") throw new Error("名前変更の内容が不正です。");
  const { versionDir, agentName } = value as Record<string, unknown>;
  if (typeof versionDir !== "string" || !versionDir) {
    throw new Error("バージョンを選択してください。");
  }
  if (
    typeof agentName !== "string" || !agentName.trim() || agentName.trim().length > 40 ||
    /[\r\n]/.test(agentName)
  ) {
    throw new Error("AI名は1〜40文字で入力してください。");
  }
  const version = await renameVersion(projectDir, versionDir, agentName);
  return { version, dashboard: await dashboard(projectDir) };
});

expose("deleteVersion", async (versionDir: unknown) => {
  if (typeof versionDir !== "string" || !versionDir) {
    throw new Error("バージョンを選択してください。");
  }
  await deleteVersion(projectDir, versionDir);
  return { versions: await listVersions(projectDir) };
});

expose("stopMatch", () => matchController.stop());
expose("startMatch", (value: unknown) => {
  if (shuttingDown) throw new Error("アプリを終了しています。");
  return matchController.start(value);
});

expose("improveWithAgent", (value: unknown) => {
  if (shuttingDown) throw new Error("アプリを終了しています。");
  return codingAgentController.improve(value);
});

const handleLocalRequest = createLocalRequestHandler({
  apiToken,
  apiHandlers,
  staticRoot: new URL("../dist/", import.meta.url),
});
Deno.serve({ hostname: "127.0.0.1" }, handleLocalRequest);
