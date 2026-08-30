import { assertEquals } from "@std/assert";
import { join } from "@std/path";
import {
  DEPENDENCY_IMPORT_PERMISSION,
  dependencyCacheArgs,
  dependencyCheckArgs,
  dependencyInfoArgs,
  executableNames,
  findExecutable,
} from "../desktop/command_resolver.ts";

Deno.test("依存取得は公式クライアントが使うホストだけを許可する", () => {
  assertEquals(
    DEPENDENCY_IMPORT_PERMISSION,
    "--allow-import=jsr.io,raw.githubusercontent.com",
  );
  assertEquals(dependencyCacheArgs("/workspace/main.ts"), [
    "cache",
    "--no-npm",
    "--no-lock",
    "--allow-import=jsr.io,raw.githubusercontent.com",
    "/workspace/main.ts",
  ]);
});

Deno.test("依存グラフの検査もnpmと管理外ホストを使わない", () => {
  assertEquals(dependencyInfoArgs("/workspace/main.ts"), [
    "info",
    "--json",
    "--no-check",
    "--no-npm",
    "--no-lock",
    "--allow-import=jsr.io,raw.githubusercontent.com",
    "/workspace/main.ts",
  ]);
});

Deno.test("依存グラフの検査は信頼済み設定ファイルを明示できる", () => {
  assertEquals(dependencyInfoArgs("/workspace/main.ts", "/bundle/template/deno.json"), [
    "info",
    "--json",
    "--no-check",
    "--no-npm",
    "--no-lock",
    "--allow-import=jsr.io,raw.githubusercontent.com",
    "--config",
    "/bundle/template/deno.json",
    "/workspace/main.ts",
  ]);
});

Deno.test("型チェックは取得済みの非npm依存だけを使う", () => {
  assertEquals(dependencyCheckArgs("/workspace/main.ts", "/bundle/template/deno.json"), [
    "check",
    "--cached-only",
    "--no-npm",
    "--no-lock",
    "--allow-import=jsr.io,raw.githubusercontent.com",
    "--config",
    "/bundle/template/deno.json",
    "/workspace/main.ts",
  ]);
});

Deno.test("WindowsではPATHEXTの実行形式を候補にする", () => {
  assertEquals(executableNames("deno", "windows", ".EXE;.CMD"), ["deno.exe", "deno.cmd"]);
  assertEquals(executableNames("deno.exe", "windows"), ["deno.exe"]);
});

Deno.test({
  name: "PATHにある実行ファイルを絶対パスで見つける",
  ignore: Deno.build.os === "windows",
  async fn() {
    const root = await Deno.makeTempDir();
    try {
      const executable = join(root, "sample-command");
      await Deno.writeTextFile(executable, "#!/bin/sh\n");
      await Deno.chmod(executable, 0o755);

      assertEquals(
        await findExecutable("sample-command", {
          environment: { PATH: root, HOME: root },
          os: Deno.build.os,
          cwd: root,
        }),
        executable,
      );
    } finally {
      await Deno.remove(root, { recursive: true });
    }
  },
});

Deno.test({
  name: "PATHにない実行ファイルは見つからない",
  ignore: Deno.build.os === "windows",
  async fn() {
    const root = await Deno.makeTempDir();
    try {
      assertEquals(
        await findExecutable("definitely-missing", {
          environment: { PATH: root, HOME: root },
          os: Deno.build.os,
          cwd: root,
        }),
        undefined,
      );
    } finally {
      await Deno.remove(root, { recursive: true });
    }
  },
});
