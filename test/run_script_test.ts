import { assertEquals, assertStringIncludes } from "@std/assert";
import { join } from "@std/path";

async function runLauncher(hasEnvFile: boolean) {
  const projectDir = await Deno.makeTempDir();
  try {
    const binDir = join(projectDir, "bin");
    await Deno.mkdir(binDir);
    await Deno.copyFile("run.sh", join(projectDir, "run.sh"));
    await Deno.writeTextFile(
      join(binDir, "deno"),
      '#!/bin/sh\nprintf "DENO_ARGS"\nfor arg in "$@"; do printf " <%s>" "$arg"; done\nprintf "\\n"\n',
    );
    await Deno.chmod(join(binDir, "deno"), 0o755);
    await Deno.mkdir(join(projectDir, "Kakomimasu"));
    await Deno.writeTextFile(
      join(projectDir, "Kakomimasu", "Kakomimasu"),
      "#!/bin/sh\nexit 0\n",
    );
    await Deno.chmod(join(projectDir, "Kakomimasu", "Kakomimasu"), 0o755);
    if (hasEnvFile) await Deno.writeTextFile(join(projectDir, ".env"), "AI_NAME=test\n");

    const result = await new Deno.Command("bash", {
      args: ["run.sh"],
      cwd: projectDir,
      env: { PATH: `${binDir}:/usr/bin:/bin` },
      stdout: "piped",
      stderr: "piped",
    }).output();

    return {
      code: result.code,
      stdout: new TextDecoder().decode(result.stdout),
      stderr: new TextDecoder().decode(result.stderr),
    };
  } finally {
    await Deno.remove(projectDir, { recursive: true });
  }
}

const desktopTask = Deno.build.os === "darwin" ? "desktop:mac" : "desktop";

Deno.test({
  name: "run.shは.envがなくてもset -uで失敗せず起動する",
  ignore: Deno.build.os === "windows",
  async fn() {
    const result = await runLauncher(false);

    assertEquals(result.code, 0);
    assertEquals(result.stderr, "");
    assertStringIncludes(result.stdout, `DENO_ARGS <task> <${desktopTask}>`);
  },
});

Deno.test({
  name: "run.shは.envがある場合だけDenoへ読み込みを指示する",
  ignore: Deno.build.os === "windows",
  async fn() {
    const result = await runLauncher(true);

    assertEquals(result.code, 0);
    assertEquals(result.stderr, "");
    assertStringIncludes(result.stdout, `DENO_ARGS <task> <--env-file=.env> <${desktopTask}>`);
  },
});

Deno.test("デスクトップタスクは起動スクリプトと同じ出力名を使う", async () => {
  const config = JSON.parse(await Deno.readTextFile("deno.json"));

  for (const task of ["desktop", "desktop:mac", "desktop:windows"]) {
    assertStringIncludes(config.tasks[task], "--output Kakomimasu");
  }
});
