import { join } from "@std/path";

export async function createAgentWorkspace(
  versionDir: string,
  configPath: string,
): Promise<string> {
  const workspace = await Deno.makeTempDir({ prefix: "kakomi-code-agent-" });
  try {
    await Deno.copyFile(join(versionDir, "main.ts"), join(workspace, "main.ts"));
    await Deno.copyFile(configPath, join(workspace, "deno.json"));
    return workspace;
  } catch (error) {
    await Deno.remove(workspace, { recursive: true }).catch(() => {});
    throw error;
  }
}

export async function applyAgentMain(
  workspace: string,
  versionDir: string,
  maximumCharacters: number,
): Promise<void> {
  const mainPath = join(workspace, "main.ts");
  const stat = await Deno.lstat(mainPath);
  if (!stat.isFile || stat.isSymlink) {
    throw new Error("コーディングAIがmain.ts以外の形式を返したため、変更を適用しませんでした。");
  }
  const source = await Deno.readTextFile(mainPath);
  if (!source.trim() || source.length > maximumCharacters) {
    throw new Error(
      "コーディングAIが返したmain.tsの大きさが不正なため、変更を適用しませんでした。",
    );
  }
  await Deno.writeTextFile(join(versionDir, "main.ts"), source);
}
