import { assertEquals, assertFalse, assertRejects, assertStringIncludes } from "@std/assert";

Deno.test("デスクトップアプリはChromiumを内蔵する", async () => {
  const config = JSON.parse(await Deno.readTextFile("deno.json"));
  assertEquals(config.desktop?.backend, "cef");
});

Deno.test("画面はViteでReactをバンドルして起動する", async () => {
  const config = JSON.parse(await Deno.readTextFile("deno.json"));
  const packageConfig = JSON.parse(await Deno.readTextFile("package.json"));
  const html = await Deno.readTextFile("index.html");
  const reactApp = await Deno.readTextFile("desktop/ui/app.tsx");
  const appHook = await Deno.readTextFile("desktop/ui/hooks/use-kakomi-app.ts");
  const server = await Deno.readTextFile("server.ts");
  const viteConfig = await Deno.readTextFile("vite.config.ts");

  assertStringIncludes(packageConfig.dependencies.react, "19.2");
  assertStringIncludes(packageConfig.dependencies["react-dom"], "19.2");
  assertStringIncludes(packageConfig.devDependencies.vite, "8.2");
  assertEquals(packageConfig.scripts.build, "vite build");
  assertEquals(config.tasks["ui:build"], "deno task build");
  assertStringIncludes(config.tasks.desktop, "deno desktop");
  assertStringIncludes(config.tasks.desktop, " .");
  assertEquals(config.compile.include, ["dist", "template"]);
  assertStringIncludes(config.tasks.desktop, "--allow-run");
  assertStringIncludes(viteConfig, 'publicDir: "node_modules/monaco-editor/min"');
  assertStringIncludes(viteConfig, 'outDir: "dist"');
  assertStringIncludes(server, 'import "./desktop/app.ts"');
  assertStringIncludes(html, '<div id="root"></div>');
  assertStringIncludes(html, '<script type="module" src="/desktop/ui.tsx"');
  assertStringIncludes(html, 'content="__KAKOMI_API_TOKEN__"');
  assertStringIncludes(reactApp, 'from "./hooks/use-kakomi-app.ts"');
  assertStringIncludes(appHook, "useDashboard(");
  assertStringIncludes(appHook, "useChat(");
  assertStringIncludes(appHook, "useMatch(");
  await assertRejects(() => Deno.stat("desktop/ui_state.js"), Deno.errors.NotFound);
  assertFalse(html.includes("alpine"));
  assertFalse(html.includes("x-data"));
});
