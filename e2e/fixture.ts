import { assertEquals } from "@std/assert";
import { join } from "@std/path";
import { chromium, type Page } from "playwright";
import { createLocalRequestHandler } from "../desktop/local_server.ts";
import { initializeProject } from "../desktop/version_manager.ts";
import { createWorkspaceApi } from "../desktop/workspace_api.ts";

type TestApp = {
  page: Page;
  projectDir: string;
  chatHistoryFile: string;
  url: string;
};

export async function withTestApp(
  name: string,
  run: (app: TestApp) => Promise<void>,
) {
  const projectDir = await Deno.makeTempDir({ prefix: "kakomi-e2e-" });
  let server: Deno.HttpServer<Deno.NetAddr> | undefined;
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  try {
    await Deno.mkdir(join(projectDir, "template"));
    await Deno.copyFile(
      new URL("../template/main.ts", import.meta.url),
      join(projectDir, "template/main.ts"),
    );
    await initializeProject(projectDir);
    const chatHistoryFile = join(projectDir, "settings/chat-history.json");
    const apiHandlers = createWorkspaceApi({ projectDir, chatHistoryFile });
    // Native window and external processes are outside these browser E2E scenarios.
    apiHandlers.set("fitWindowToScreen", () => ({}));
    apiHandlers.set("getMatchLogs", () => ({ logs: [], viewerUrl: "", running: false }));
    apiHandlers.set("getCodingAgentLogs", () => ({ logs: [], versionDir: "" }));
    apiHandlers.set("getOpenCodeModels", () => []);
    server = Deno.serve(
      { hostname: "127.0.0.1", port: 0, onListen() {} },
      createLocalRequestHandler({
        apiToken: crypto.randomUUID(),
        apiHandlers,
        staticRoot: new URL("../dist/", import.meta.url),
      }),
    );
    const url = `http://127.0.0.1:${server.addr.port}`;
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    context.setDefaultTimeout(10_000);
    await context.tracing.start({ screenshots: true, snapshots: true });
    const page = await context.newPage();
    const errors: string[] = [];
    const recordError = (message: string) => {
      if (errors.length < 50) errors.push(message.slice(0, 2_000));
    };
    page.on("pageerror", (error) => recordError(error.message));
    await context.route("**/*", async (route) => {
      if (new URL(route.request().url()).origin === url) await route.continue();
      else {
        recordError(`予期しない外部接続: ${route.request().url()}`);
        await route.abort();
      }
    });
    try {
      await run({ page, projectDir, chatHistoryFile, url });
      assertEquals(errors, [], "ブラウザ内でエラーまたは外部接続が発生しました。");
    } catch (error) {
      const output = join("e2e-results", name);
      await Deno.mkdir(output, { recursive: true });
      await page.screenshot({ path: join(output, "failure.png"), fullPage: true }).catch(() => {});
      await context.tracing.stop({ path: join(output, "trace.zip") }).catch(() => {});
      await Deno.writeTextFile(join(output, "errors.json"), JSON.stringify(errors, null, 2));
      throw error;
    } finally {
      await context.close();
    }
  } finally {
    try {
      await browser?.close();
    } finally {
      try {
        await server?.shutdown();
      } finally {
        await Deno.remove(projectDir, { recursive: true });
      }
    }
  }
}

export async function openApp(page: Page, url: string) {
  await page.goto(url);
  await page.getByRole("heading", { name: "囲みコード", exact: true }).waitFor();
  await page.getByRole("region", { name: "main.ts ソースコードエディタ" })
    .locator(".view-lines").getByText("import", { exact: true }).first().waitFor();
}

export function versionRow(page: Page, name: string) {
  return page.locator(".version-row").filter({
    has: page.getByRole("button", { name, exact: true }),
  });
}

export async function submitName(page: Page, name: string, confirm: string) {
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("textbox", { name: "名前", exact: true }).fill(name);
  await dialog.getByRole("button", { name: confirm, exact: true }).click();
  await dialog.waitFor({ state: "hidden" });
}
