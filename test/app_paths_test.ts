import { assertEquals } from "@std/assert";
import { join } from "@std/path";
import { resolveProjectDirectory, resolveSettingsDir } from "../desktop/app_paths.ts";

Deno.test("設定フォルダはHOMEまたはUSERPROFILEの下に置く", () => {
  assertEquals(
    resolveSettingsDir({ HOME: "/home/user" }, "/tmp"),
    "/home/user/.kakomimasu-ai-starter",
  );
  assertEquals(
    resolveSettingsDir({ USERPROFILE: "C:\\Users\\user" }, "C:\\tmp"),
    join("C:\\Users\\user", ".kakomimasu-ai-starter"),
  );
});

Deno.test("保存済みの作業フォルダを引き続き使う", async () => {
  const root = await Deno.makeTempDir();
  try {
    const settingsDir = join(root, "settings");
    const projectDir = join(root, "project");
    await Deno.mkdir(join(projectDir, "template"), { recursive: true });
    await Deno.mkdir(settingsDir);
    await Deno.writeTextFile(join(projectDir, "template", "main.ts"), "// saved\n");
    await Deno.writeTextFile(join(settingsDir, "project-dir.txt"), projectDir);

    assertEquals(
      await resolveProjectDirectory({
        settingsDir,
        cwd: root,
        executablePath: join(root, "app"),
        bundledTemplatePath: join(root, "missing.ts"),
        bundledConfigPath: join(root, "missing.json"),
      }),
      projectDir,
    );
  } finally {
    await Deno.remove(root, { recursive: true });
  }
});

Deno.test("配布版はユーザー領域へテンプレートを展開する", async () => {
  const root = await Deno.makeTempDir();
  try {
    const settingsDir = join(root, "settings");
    const bundledTemplatePath = join(root, "bundle", "template", "main.ts");
    const bundledConfigPath = join(root, "bundle", "template", "deno.json");
    await Deno.mkdir(join(root, "bundle", "template"), { recursive: true });
    await Deno.writeTextFile(bundledTemplatePath, "// bundled\n");
    await Deno.writeTextFile(bundledConfigPath, '{"imports":{}}\n');

    const projectDir = await resolveProjectDirectory({
      settingsDir,
      cwd: join(root, "cwd"),
      executablePath: join(root, "installed", "KakomiCode"),
      bundledTemplatePath,
      bundledConfigPath,
    });

    assertEquals(projectDir, join(settingsDir, "workspace"));
    assertEquals(
      await Deno.readTextFile(join(projectDir, "template", "main.ts")),
      "// bundled\n",
    );
    assertEquals(await Deno.readTextFile(join(projectDir, "deno.json")), '{"imports":{}}\n');

    await Deno.writeTextFile(join(projectDir, "template", "main.ts"), "// old\n");
    assertEquals(
      await resolveProjectDirectory({
        settingsDir,
        cwd: projectDir,
        executablePath: join(root, "installed", "KakomiCode"),
        bundledTemplatePath,
        bundledConfigPath,
      }),
      projectDir,
    );
    assertEquals(
      await Deno.readTextFile(join(projectDir, "template", "main.ts")),
      "// bundled\n",
    );
  } finally {
    await Deno.remove(root, { recursive: true });
  }
});
