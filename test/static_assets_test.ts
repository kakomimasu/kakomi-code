import { assertEquals } from "@std/assert";
import { join } from "@std/path";
import {
  resolveStaticAsset,
  staticAssetRelativePath,
  staticContentType,
} from "../desktop/static_assets.ts";

Deno.test("画面生成物の安全な相対パスだけを許可する", () => {
  assertEquals(staticAssetRelativePath("/"), "index.html");
  assertEquals(staticAssetRelativePath("/assets/app.js"), "assets/app.js");
  assertEquals(staticAssetRelativePath("/vs/editor/editor.main.css"), "vs/editor/editor.main.css");
  assertEquals(staticAssetRelativePath("/%2e%2e/secret"), null);
  assertEquals(staticAssetRelativePath("/assets/%2E%2E/secret"), null);
  assertEquals(staticAssetRelativePath("/%252e%252e/secret"), null);
  assertEquals(staticAssetRelativePath("/assets/%252E%252E/secret"), null);
  assertEquals(staticAssetRelativePath("/%252e%252e%252fsecret"), null);
  assertEquals(staticAssetRelativePath("/assets%255csecret"), null);
  assertEquals(staticAssetRelativePath("/assets\\secret"), null);
  assertEquals(staticAssetRelativePath("/assets//secret"), null);
  assertEquals(staticAssetRelativePath("/%00secret"), null);
  assertEquals(staticAssetRelativePath("/%E0%A4%A"), null);
  assertEquals(staticAssetRelativePath("assets/app.js"), null);
});

Deno.test("画面生成物の解決後パスをdist内に固定する", async () => {
  const workspace = await Deno.makeTempDir();
  try {
    const dist = join(workspace, "dist");
    const asset = join(dist, "assets", "app.js");
    await Deno.mkdir(join(dist, "assets"), { recursive: true });
    await Deno.writeTextFile(asset, "console.log('ok');\n");
    await Deno.writeTextFile(join(workspace, "secret"), "secret\n");

    assertEquals(await resolveStaticAsset(dist, "/assets/app.js"), {
      file: await Deno.realPath(asset),
      relativePath: "assets/app.js",
    });
    assertEquals(await resolveStaticAsset(dist, "/%252e%252e/secret"), null);
    assertEquals(await resolveStaticAsset(dist, "/missing.js"), null);
  } finally {
    await Deno.remove(workspace, { recursive: true });
  }
});

Deno.test("dist内のsymlinkから外部ファイルを配信しない", async () => {
  const workspace = await Deno.makeTempDir();
  try {
    const dist = join(workspace, "dist");
    const outside = join(workspace, "secret.txt");
    await Deno.mkdir(dist);
    await Deno.writeTextFile(outside, "secret\n");
    await Deno.symlink(outside, join(dist, "linked.txt"));

    assertEquals(await resolveStaticAsset(dist, "/linked.txt"), null);
  } finally {
    await Deno.remove(workspace, { recursive: true });
  }
});

Deno.test("distルート自体がsymlinkの場合は外部ファイルを配信しない", async () => {
  const workspace = await Deno.makeTempDir();
  try {
    const outside = join(workspace, "outside");
    const dist = join(workspace, "dist");
    await Deno.mkdir(outside);
    await Deno.writeTextFile(join(outside, "index.html"), "secret\n");
    await Deno.symlink(outside, dist);

    assertEquals(await resolveStaticAsset(dist, "/"), null);
  } finally {
    await Deno.remove(workspace, { recursive: true });
  }
});

Deno.test("画面生成物へContent-Typeを設定する", () => {
  assertEquals(staticContentType("index.html"), "text/html; charset=utf-8");
  assertEquals(staticContentType("assets/app.js"), "text/javascript; charset=utf-8");
  assertEquals(staticContentType("assets/app.css"), "text/css; charset=utf-8");
  assertEquals(staticContentType("assets/app.png"), "image/png");
  assertEquals(staticContentType("assets/data.bin"), "application/octet-stream");
});
