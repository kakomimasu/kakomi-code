import { assertEquals, assertFalse, assertRejects, assertStringIncludes } from "@std/assert";

Deno.test("デスクトップアプリはChromiumを内蔵する", async () => {
  const config = JSON.parse(await Deno.readTextFile("deno.json"));
  assertEquals(config.desktop?.backend, "cef");
});

Deno.test("画面はReactとDenoのバンドラーだけで起動する", async () => {
  const config = JSON.parse(await Deno.readTextFile("deno.json"));
  const html = await Deno.readTextFile("desktop/index.html");
  const buildScript = await Deno.readTextFile("scripts/build_ui.ts");
  const reactEntry = await Deno.readTextFile("desktop/ui.tsx");
  const reactApp = await Deno.readTextFile("desktop/ui/app.tsx");
  const errorBoundary = await Deno.readTextFile("desktop/ui/error-boundary.tsx");
  const dialogs = await Deno.readTextFile("desktop/ui/dialogs.tsx");
  const primitives = await Deno.readTextFile("desktop/ui/primitives.tsx");
  const sidebar = await Deno.readTextFile("desktop/ui/sidebar.tsx");
  const chatPane = await Deno.readTextFile("desktop/ui/chat.tsx");
  const appHook = await Deno.readTextFile("desktop/ui/hooks/use-kakomi-app.ts");
  const dashboardHook = await Deno.readTextFile("desktop/ui/hooks/use-dashboard.ts");
  const chatHook = await Deno.readTextFile("desktop/ui/hooks/use-chat.ts");
  const monacoHook = await Deno.readTextFile("desktop/ui/hooks/use-monaco-editor.ts");
  const utilityPane = await Deno.readTextFile("desktop/ui/utility.tsx");
  const style = await Deno.readTextFile("desktop/style.css");
  const store = await Deno.readTextFile("desktop/ui/hooks/use-app-state.ts");

  assertStringIncludes(config.imports.react, "19.2");
  assertStringIncludes(config.imports["react-dom"], "19.2");
  assertStringIncludes(config.imports["monaco-editor"], "0.56");
  assertStringIncludes(config.tasks["ui:build"], "scripts/build_ui.ts");
  assertStringIncludes(config.tasks.desktop, "deno task ui:build");
  assertStringIncludes(config.tasks.desktop, "desktop/app.ts");
  assertEquals(config.compile.include, ["dist", "template"]);
  assertStringIncludes(buildScript, '"bundle"');
  assertStringIncludes(buildScript, '"browser"');
  assertStringIncludes(buildScript, 'import.meta.resolve("monaco-editor")');
  assertStringIncludes(html, '<div id="root"></div>');
  assertStringIncludes(html, '<script type="module" src="/ui.js"');
  assertStringIncludes(html, '<link rel="stylesheet" href="/desktop/style.css"');
  assertStringIncludes(html, 'content="__KAKOMI_API_TOKEN__"');
  assertStringIncludes(reactApp, 'from "./hooks/use-kakomi-app.ts"');
  assertStringIncludes(reactEntry, "<AppErrorBoundary>");
  assertStringIncludes(errorBoundary, "getDerivedStateFromError");
  assertStringIncludes(errorBoundary, 'role="alert"');
  assertStringIncludes(appHook, "useDashboard(");
  assertStringIncludes(appHook, "useChat(");
  assertStringIncludes(appHook, "useMatch(");
  assertStringIncludes(dialogs, 'role={request.kind === "confirm" ? "alertdialog" : "dialog"}');
  assertStringIncludes(primitives, "export const Button");
  assertStringIncludes(primitives, "export function statusTone");
  assertStringIncludes(primitives, 'role={error ? "alert" : "status"}');
  assertStringIncludes(sidebar, "<TooltipButton");
  assertStringIncludes(sidebar, "aria-pressed={app.selected === version.path}");
  assertStringIncludes(chatPane, 'role="log"');
  assertStringIncludes(chatPane, 'aria-label="チャット履歴"');
  assertStringIncludes(chatPane, "aria-pressed={app.agent === agent.id}");
  assertStringIncludes(utilityPane, "<Button");
  assertStringIncludes(style, ".match-button");
  assertStringIncludes(style, ".source-save-button");
  assertStringIncludes(monacoHook, "diagnosticCodesToIgnore: [2307, 2792]");
  assertStringIncludes(monacoHook, "module: monaco.languages.typescript.ModuleKind.ESNext");
  assertStringIncludes(monacoHook, '"file:///deno-env.d.ts"');
  assertStringIncludes(store, "useSyncExternalStore");
  assertFalse(store.includes("zustand"));
  assertFalse(style.includes("tailwindcss"));
  assertFalse(dashboardHook.includes("prompt("));
  assertFalse(dashboardHook.includes("confirm("));
  assertFalse(chatHook.includes("confirm("));
  assertFalse(html.includes("alpine"));

  for (const removed of ["package.json", "vite.config.ts", "server.ts", "desktop/ui_state.js"]) {
    await assertRejects(() => Deno.stat(removed), Deno.errors.NotFound);
  }
});
