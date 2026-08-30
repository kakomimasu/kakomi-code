type Environment = Record<string, string | undefined>;
type OperatingSystem = typeof Deno.build.os;

type FindExecutableOptions = {
  environment?: Environment;
  os?: OperatingSystem;
  cwd?: string;
};

const dependencyImportHosts = ["jsr.io", "raw.githubusercontent.com"];
export const DEPENDENCY_IMPORT_PERMISSION = `--allow-import=${dependencyImportHosts.join(",")}`;

export function dependencyInfoArgs(mainPath: string, configPath?: string): string[] {
  return [
    "info",
    "--json",
    "--no-check",
    "--no-npm",
    "--no-lock",
    DEPENDENCY_IMPORT_PERMISSION,
    ...(configPath ? ["--config", configPath] : []),
    mainPath,
  ];
}

export function dependencyCacheArgs(mainPath: string): string[] {
  return [
    "cache",
    "--no-npm",
    "--no-lock",
    DEPENDENCY_IMPORT_PERMISSION,
    mainPath,
  ];
}

export function dependencyCheckArgs(mainPath: string, configPath: string): string[] {
  return [
    "check",
    "--cached-only",
    "--no-npm",
    "--no-lock",
    DEPENDENCY_IMPORT_PERMISSION,
    "--config",
    configPath,
    mainPath,
  ];
}

function joinPath(os: OperatingSystem, directory: string, ...parts: string[]): string {
  const separator = os === "windows" ? "\\" : "/";
  const base = directory.replace(/[\\/]+$/, "");
  const prefix = base || separator;
  return `${prefix}${base ? separator : ""}${parts.join(separator)}`;
}

export function executableNames(
  command: string,
  os: OperatingSystem,
  pathExt = ".EXE;.CMD;.BAT;.COM",
): string[] {
  if (os !== "windows" || /\.[^\\/]+$/.test(command)) return [command];
  return pathExt.split(";").filter(Boolean).map((extension) => command + extension.toLowerCase());
}

export async function findExecutable(
  command: string,
  options: FindExecutableOptions = {},
): Promise<string | undefined> {
  const environment = options.environment ?? Deno.env.toObject();
  const os = options.os ?? Deno.build.os;
  const cwd = options.cwd ?? Deno.cwd();
  const separator = os === "windows" ? ";" : ":";
  const home = environment.HOME || environment.USERPROFILE || cwd;
  const directories = (environment.PATH ?? "").split(separator).filter(Boolean);

  if (environment.DENO_INSTALL) directories.push(joinPath(os, environment.DENO_INSTALL, "bin"));
  directories.push(joinPath(os, home, ".deno", "bin"));

  if (os === "windows") {
    if (environment.APPDATA) directories.push(joinPath(os, environment.APPDATA, "npm"));
  } else {
    directories.push(joinPath(os, home, ".local", "bin"), "/usr/local/bin", "/usr/bin", "/bin");
    if (os === "darwin") directories.push("/opt/homebrew/bin");
  }

  const names = executableNames(command, os, environment.PATHEXT);
  for (const directory of [...new Set(directories)]) {
    for (const name of names) {
      const candidate = joinPath(os, directory, name);
      try {
        const stat = await Deno.stat(candidate);
        const executable = os === "windows" || ((stat.mode ?? 0) & 0o111) !== 0;
        if (stat.isFile && executable) return candidate;
      } catch { /* 次の候補へ */ }
    }
  }
  return undefined;
}
