import { assertEquals } from "@std/assert";
import { join } from "@std/path";
import {
  dependencyCacheArgs,
  executableNames,
  findExecutable,
} from "../desktop/command_resolver.ts";

Deno.test("依存取得は公式クライアントが使うホストだけを許可する", () => {
  assertEquals(dependencyCacheArgs("/workspace/main.ts"), [
    "cache",
    "--allow-import=jsr.io,raw.githubusercontent.com",
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
