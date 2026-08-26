import { dirname, join } from "@std/path";

type Environment = Record<string, string | undefined>;

type ProjectDirectoryOptions = {
  settingsDir: string;
  cwd: string;
  executablePath: string;
  bundledTemplatePath: string;
  bundledConfigPath: string;
};

async function hasTemplate(projectDir: string): Promise<boolean> {
  try {
    const stat = await Deno.stat(join(projectDir, "template", "main.ts"));
    return stat.isFile;
  } catch {
    return false;
  }
}

function executableProjectCandidates(executablePath: string): string[] {
  const executableDir = dirname(executablePath);
  const macBundle = executablePath.match(/^(.*)\/[^/]+\.app\/Contents\/MacOS\/[^/]+$/);
  return macBundle ? [macBundle[1], executableDir] : [executableDir];
}

export function resolveSettingsDir(environment: Environment, cwd: string): string {
  const home = environment.HOME || environment.USERPROFILE || cwd;
  return join(home, ".kakomimasu-ai-starter");
}

export async function resolveProjectDirectory(
  options: ProjectDirectoryOptions,
): Promise<string> {
  const projectFile = join(options.settingsDir, "project-dir.txt");
  const workspaceDir = join(options.settingsDir, "workspace");
  let savedProject = "";
  try {
    savedProject = (await Deno.readTextFile(projectFile)).trim();
  } catch { /* 初回起動ではまだ保存されていない */ }

  const candidates = [
    savedProject,
    options.cwd,
    ...executableProjectCandidates(options.executablePath),
  ];
  for (const candidate of [...new Set(candidates.filter(Boolean))]) {
    if (!await hasTemplate(candidate)) continue;
    if (candidate !== workspaceDir) return candidate;
    await installBundledWorkspace(options, workspaceDir);
    return workspaceDir;
  }

  await installBundledWorkspace(options, workspaceDir);
  return workspaceDir;
}

async function installBundledWorkspace(
  options: ProjectDirectoryOptions,
  workspaceDir: string,
): Promise<void> {
  try {
    const [templateStat, configStat] = await Promise.all([
      Deno.stat(options.bundledTemplatePath),
      Deno.stat(options.bundledConfigPath),
    ]);
    if (!templateStat.isFile || !configStat.isFile) throw new Error();
  } catch {
    throw new Error("スターターキットのテンプレートを自動検出できませんでした。");
  }

  const templateDir = join(workspaceDir, "template");
  await Deno.mkdir(templateDir, { recursive: true });
  await Deno.copyFile(options.bundledTemplatePath, join(templateDir, "main.ts"));
  await Deno.copyFile(options.bundledConfigPath, join(workspaceDir, "deno.json"));
}
