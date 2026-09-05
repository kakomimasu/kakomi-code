import { join } from "@std/path";
import { MAX_SOURCE_CHARACTERS } from "./api_requests.ts";
import { applicationMenu } from "./application_menu.ts";
import { resolveProjectDirectory, resolveSettingsDir } from "./app_paths.ts";
import { CodingAgentController } from "./coding_agent_controller.ts";
import { type ApiHandler, createLocalRequestHandler } from "./local_server.ts";
import { MatchController } from "./match_controller.ts";
import { validateWindowGeometry } from "./window_geometry.ts";
import { initializeProject } from "./version_manager.ts";
import { createWorkspaceApi } from "./workspace_api.ts";

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

async function saveProjectDir(projectDir: string) {
  await Deno.mkdir(settingsDir, { recursive: true });
  await Deno.writeTextFile(projectFile, projectDir);
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
for (const [name, handler] of createWorkspaceApi({ projectDir, chatHistoryFile })) {
  expose(name, handler);
}
expose("getOpenCodeModels", () => codingAgentController.getOpenCodeModels());
expose("getMatchLogs", () => matchController.getState());
expose("getCodingAgentLogs", () => codingAgentController.getState());
expose("stopCodingAgent", () => codingAgentController.stop());
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
