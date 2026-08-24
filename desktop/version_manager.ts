import { basename, dirname, join, resolve } from "@std/path";

export type VersionInfo = { name: string; path: string; ready: boolean };
export const BASE_VERSION_NAME = "エルメマス1号";
export const TEMPLATE_PATH = "template/main.ts";
const VERSION_PATTERN = /^v(\d{3})-/;

function isManagedVersionName(name: string): boolean {
  return name === BASE_VERSION_NAME || VERSION_PATTERN.test(name);
}

async function exists(path: string): Promise<boolean> {
  try {
    await Deno.stat(path);
    return true;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) return false;
    throw error;
  }
}

export async function listVersions(projectDir: string): Promise<VersionInfo[]> {
  const versions: VersionInfo[] = [];
  try {
    for await (const entry of Deno.readDir(join(projectDir, "versions"))) {
      if (!entry.isDirectory || !isManagedVersionName(entry.name)) continue;
      const path = join(projectDir, "versions", entry.name);
      const ready = await exists(join(path, "main.ts"));
      versions.push({ name: entry.name, path, ready });
    }
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) throw error;
  }
  return versions.sort((a, b) => {
    if (a.name === BASE_VERSION_NAME) return -1;
    if (b.name === BASE_VERSION_NAME) return 1;
    return a.name.localeCompare(b.name);
  });
}

export async function validateVersion(projectDir: string, versionDir: string): Promise<string> {
  const root = await Deno.realPath(join(projectDir, "versions"));
  const target = await Deno.realPath(versionDir);
  if (dirname(target) !== root || !isManagedVersionName(basename(target))) {
    throw new Error("versions配下の有効なバージョンを選択してください");
  }
  if (!await exists(join(target, "main.ts"))) {
    throw new Error("main.ts がありません");
  }
  return target;
}

function slugify(label: string): string {
  return label.trim().replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, "-").replace(/^-|-$/g, "") ||
    "エルメマス";
}

export async function createVersion(
  projectDir: string,
  label: string,
  sourceVersionDir?: string,
): Promise<VersionInfo> {
  const project = resolve(projectDir);
  const versionsDir = join(project, "versions");
  await Deno.mkdir(versionsDir, { recursive: true });
  const versions = await listVersions(project);
  const previous = sourceVersionDir
    ? versions.find((version) => version.path === sourceVersionDir)
    : undefined;
  if (sourceVersionDir && !previous) throw new Error("コピー元のバージョンが見つかりません。");
  const next = Math.max(
    1,
    ...versions.map((version) => Number(version.name.match(VERSION_PATTERN)?.[1] ?? 0)),
  ) + 1;
  const agentName = slugify(label).slice(0, 40);
  const name = `v${String(next).padStart(3, "0")}-${agentName}`;
  const target = join(versionsDir, name);

  const sourcePath = previous ? join(previous.path, "main.ts") : join(project, TEMPLATE_PATH);
  if (!await exists(sourcePath)) {
    throw new Error(
      `新規エージェント用のテンプレートがありません。${TEMPLATE_PATH} を用意してください。`,
    );
  }
  await Deno.mkdir(target, { recursive: true });
  await Deno.copyFile(sourcePath, join(target, "main.ts"));
  return { name, path: target, ready: true };
}

export async function renameVersion(
  projectDir: string,
  versionDir: string,
  label: string,
): Promise<VersionInfo> {
  const target = await validateVersion(projectDir, versionDir);
  const currentName = basename(target);
  const number = currentName.match(VERSION_PATTERN)?.[1] ??
    (currentName === BASE_VERSION_NAME ? "001" : undefined);
  if (!number) throw new Error("バージョン番号を取得できませんでした。");

  const name = `v${number}-${slugify(label).slice(0, 40)}`;
  const renamed = join(dirname(target), name);
  if (renamed === target) return { name, path: renamed, ready: true };
  if (await exists(renamed)) throw new Error("同じ名前のバージョンがすでにあります。");

  await Deno.rename(target, renamed);
  return { name, path: renamed, ready: true };
}

/** Delete one managed version after confirming it is a direct child of versions/. */
export async function deleteVersion(projectDir: string, versionDir: string): Promise<void> {
  const root = await Deno.realPath(join(projectDir, "versions"));
  const target = await Deno.realPath(versionDir);
  if (dirname(target) !== root || !isManagedVersionName(basename(target))) {
    throw new Error("versions配下の有効なバージョンを選択してください");
  }
  await Deno.remove(target, { recursive: true });
}
