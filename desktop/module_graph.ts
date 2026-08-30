import { fromFileUrl, isAbsolute, relative, SEPARATOR } from "@std/path";

const ALLOWED_REMOTE_HOSTS = new Set(["jsr.io", "raw.githubusercontent.com"]);

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function isWithin(root: string, candidate: string): boolean {
  const fromRoot = relative(root, candidate);
  return fromRoot !== ".." && !fromRoot.startsWith(`..${SEPARATOR}`) &&
    !isAbsolute(fromRoot);
}

/** Validate the complete graph emitted by `deno info --json` before execution. */
export async function validateModuleGraph(
  graphOutput: string,
  workspace: string,
): Promise<void> {
  let graph: Record<string, unknown>;
  try {
    const parsed = record(JSON.parse(graphOutput));
    if (!parsed) throw new Error();
    graph = parsed;
  } catch {
    throw new Error("依存関係の検査結果を読み取れませんでした。");
  }
  if (!Array.isArray(graph.modules) || graph.modules.length > 10_000) {
    throw new Error("依存関係の数が多すぎるか、検査結果が不正です。");
  }

  const realWorkspace = await Deno.realPath(workspace);
  for (const value of graph.modules) {
    const module = record(value);
    if (!module || typeof module.specifier !== "string") {
      throw new Error("依存関係の検査結果が不正です。");
    }
    let specifier: URL;
    try {
      specifier = new URL(module.specifier);
    } catch {
      throw new Error(`使用できないimportです: ${module.specifier}`);
    }

    if (specifier.protocol === "file:") {
      let realModule: string;
      try {
        realModule = await Deno.realPath(fromFileUrl(specifier));
      } catch {
        throw new Error(`読み取れないローカルimportです: ${module.specifier}`);
      }
      if (!isWithin(realWorkspace, realModule)) {
        throw new Error("main.tsと同じ一時フォルダーの外にあるファイルはimportできません。");
      }
      continue;
    }

    if (
      specifier.protocol !== "https:" || specifier.port ||
      !ALLOWED_REMOTE_HOSTS.has(specifier.hostname)
    ) {
      throw new Error(`許可されていないimport先です: ${module.specifier}`);
    }
  }
}
