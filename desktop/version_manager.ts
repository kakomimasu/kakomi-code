import { basename, dirname, join, resolve } from "@std/path";

export type VersionInfo = { name: string; path: string; ready: boolean };
export const BASE_VERSION_NAME = "エルメマス1号";
export const TEMPLATE_PATH = "template/main.ts";
const VERSION_PATTERN = /^v(\d{3,})-/;

export function normalizeSourceVersion(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") {
    throw new Error("コピー元のバージョンが不正です。");
  }
  return value;
}

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
    const aNumber = Number(a.name.match(VERSION_PATTERN)?.[1] ?? 0);
    const bNumber = Number(b.name.match(VERSION_PATTERN)?.[1] ?? 0);
    return aNumber === bNumber ? a.name.localeCompare(b.name) : aNumber - bNumber;
  });
}

export async function validateVersion(projectDir: string, versionDir: string): Promise<string> {
  const root = await Deno.realPath(join(projectDir, "versions"));
  const target = await Deno.realPath(versionDir);
  if (dirname(target) !== root || !isManagedVersionName(basename(target))) {
    throw new Error("versions配下の有効なバージョンを選択してください");
  }
  try {
    const mainPath = await Deno.realPath(join(target, "main.ts"));
    const mainStat = await Deno.stat(mainPath);
    if (dirname(mainPath) !== target || !mainStat.isFile) throw new Error();
  } catch {
    throw new Error("main.ts がありません");
  }
  return target;
}

function slugify(label: string): string {
  const safeLabel = [...label.trim()].map((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint < 32 || codePoint === 127 ? "-" : character;
  }).join("");
  return safeLabel.replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, "-")
    .replace(/^-|-$/g, "") || "エルメマス";
}

function versionLabel(label: string): string {
  return [...slugify(label)].slice(0, 40).join("");
}

/** Prepare a fresh clone without recreating versions that the user deleted later. */
export async function initializeProject(projectDir: string): Promise<void> {
  const project = resolve(projectDir);
  const template = join(project, TEMPLATE_PATH);
  if (!await exists(template)) {
    throw new Error(
      `新規エージェント用のテンプレートがありません。${TEMPLATE_PATH} を用意してください。`,
    );
  }

  const versionsDir = join(project, "versions");
  if (await exists(versionsDir)) return;

  const baseDir = join(versionsDir, BASE_VERSION_NAME);
  await Deno.mkdir(baseDir, { recursive: true });
  try {
    await Deno.copyFile(template, join(baseDir, "main.ts"));
  } catch (error) {
    await Deno.remove(versionsDir, { recursive: true }).catch(() => {});
    throw error;
  }
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
  const sourcePath = sourceVersionDir
    ? join(await validateVersion(project, sourceVersionDir), "main.ts")
    : join(project, TEMPLATE_PATH);
  const next = Math.max(
    1,
    ...versions.map((version) => Number(version.name.match(VERSION_PATTERN)?.[1] ?? 0)),
  ) + 1;
  const agentName = versionLabel(label);
  const name = `v${String(next).padStart(3, "0")}-${agentName}`;
  const target = join(versionsDir, name);

  if (!await exists(sourcePath)) {
    throw new Error(
      `新規エージェント用のテンプレートがありません。${TEMPLATE_PATH} を用意してください。`,
    );
  }
  let targetCreated = false;
  try {
    // recursive:false prevents two simultaneous creations from overwriting each other.
    await Deno.mkdir(target);
    targetCreated = true;
    await Deno.copyFile(sourcePath, join(target, "main.ts"));
  } catch (error) {
    if (targetCreated) await Deno.remove(target, { recursive: true }).catch(() => {});
    throw error;
  }
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

  const name = `v${number}-${versionLabel(label)}`;
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
