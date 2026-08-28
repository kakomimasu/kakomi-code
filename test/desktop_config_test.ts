import { assertEquals, assertFalse, assertStringIncludes } from "@std/assert";

Deno.test("デスクトップアプリはChromiumを内蔵する", async () => {
  const config = JSON.parse(await Deno.readTextFile("deno.json"));
  assertEquals(config.desktop?.backend, "cef");
});

Deno.test("画面はReactをバンドルして起動する", async () => {
  const config = JSON.parse(await Deno.readTextFile("deno.json"));
  const html = await Deno.readTextFile("desktop/index.html");

  assertStringIncludes(config.imports.react, "npm:react@");
  assertStringIncludes(config.imports["react-dom"], "npm:react-dom@");
  assertStringIncludes(config.tasks["ui:build"], "desktop/ui.tsx");
  assertStringIncludes(html, '<div id="root"></div>');
  assertStringIncludes(html, '<script type="module" src="/ui.js');
  assertFalse(html.includes("alpine"));
  assertFalse(html.includes("x-data"));
});
