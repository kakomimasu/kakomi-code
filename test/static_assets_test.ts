import { assertEquals } from "@std/assert";
import { staticAssetRelativePath, staticContentType } from "../desktop/static_assets.ts";

Deno.test("画面生成物の安全な相対パスだけを許可する", () => {
  assertEquals(staticAssetRelativePath("/"), "index.html");
  assertEquals(staticAssetRelativePath("/assets/app.js"), "assets/app.js");
  assertEquals(staticAssetRelativePath("/vs/editor/editor.main.css"), "vs/editor/editor.main.css");
  assertEquals(staticAssetRelativePath("/%2e%2e/secret"), null);
  assertEquals(staticAssetRelativePath("/assets/%2E%2E/secret"), null);
  assertEquals(staticAssetRelativePath("/assets\\secret"), null);
  assertEquals(staticAssetRelativePath("/assets//secret"), null);
  assertEquals(staticAssetRelativePath("/%E0%A4%A"), null);
});

Deno.test("画面生成物へContent-Typeを設定する", () => {
  assertEquals(staticContentType("index.html"), "text/html; charset=utf-8");
  assertEquals(staticContentType("assets/app.js"), "text/javascript; charset=utf-8");
  assertEquals(staticContentType("assets/app.css"), "text/css; charset=utf-8");
  assertEquals(staticContentType("assets/app.png"), "image/png");
  assertEquals(staticContentType("assets/data.bin"), "application/octet-stream");
});
