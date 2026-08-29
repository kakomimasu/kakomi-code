import { assertEquals, assertRejects } from "@std/assert";
import { join } from "@std/path";
import { applyAgentMain, createAgentWorkspace } from "../desktop/agent_workspace.ts";

Deno.test("コーディングAIの作業結果はmain.tsだけを選択中の版へ反映する", async () => {
  const root = await Deno.makeTempDir();
  const version = join(root, "version");
  await Deno.mkdir(version);
  await Deno.writeTextFile(join(version, "main.ts"), "export const value = 1;\n");
  const config = join(root, "deno.json");
  await Deno.writeTextFile(config, '{"imports":{}}\n');
  const workspace = await createAgentWorkspace(version, config);
  try {
    assertEquals(await Deno.readTextFile(join(workspace, "deno.json")), '{"imports":{}}\n');
    await Deno.writeTextFile(join(workspace, "main.ts"), "export const value = 2;\n");
    await Deno.writeTextFile(join(workspace, "memo.txt"), "反映しない");
    await applyAgentMain(workspace, version, 1_000);

    assertEquals(await Deno.readTextFile(join(version, "main.ts")), "export const value = 2;\n");
    await assertRejects(() => Deno.stat(join(version, "memo.txt")), Deno.errors.NotFound);
  } finally {
    await Deno.remove(root, { recursive: true });
    await Deno.remove(workspace, { recursive: true }).catch(() => {});
  }
});

Deno.test("コーディングAIがmain.tsをシンボリックリンクへ変えた場合は反映しない", async () => {
  if (Deno.build.os === "windows") return;
  const root = await Deno.makeTempDir();
  const version = join(root, "version");
  await Deno.mkdir(version);
  await Deno.writeTextFile(join(version, "main.ts"), "original\n");
  const config = join(root, "deno.json");
  await Deno.writeTextFile(config, '{"imports":{}}\n');
  const workspace = await createAgentWorkspace(version, config);
  try {
    await Deno.remove(join(workspace, "main.ts"));
    await Deno.symlink(join(version, "main.ts"), join(workspace, "main.ts"));
    await assertRejects(() => applyAgentMain(workspace, version, 1_000), Error, "形式");
    assertEquals(await Deno.readTextFile(join(version, "main.ts")), "original\n");
  } finally {
    await Deno.remove(root, { recursive: true });
    await Deno.remove(workspace, { recursive: true }).catch(() => {});
  }
});
