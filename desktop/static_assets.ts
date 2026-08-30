import { fromFileUrl, isAbsolute, relative, resolve, SEPARATOR } from "@std/path";

const CONTENT_TYPES = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".webp", "image/webp"],
  [".ttf", "font/ttf"],
  [".woff", "font/woff"],
  [".woff2", "font/woff2"],
]);

export function staticAssetRelativePath(pathname: string): string | null {
  if (!pathname.startsWith("/")) return null;
  let relativePath: string;
  try {
    relativePath = pathname === "/" ? "index.html" : decodeURIComponent(pathname.slice(1));
  } catch {
    return null;
  }
  if (
    !relativePath || relativePath.includes("\\") || /%[0-9a-f]{2}/i.test(relativePath) ||
    [...relativePath].some((character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      return codePoint < 32 || codePoint === 127;
    }) ||
    relativePath.split("/").some((part) => !part || part === "." || part === "..")
  ) {
    return null;
  }
  return relativePath;
}

function isWithin(root: string, candidate: string): boolean {
  const fromRoot = relative(root, candidate);
  return fromRoot !== ".." && !fromRoot.startsWith(`..${SEPARATOR}`) &&
    !isAbsolute(fromRoot);
}

/** Resolve one existing static file and keep its real path inside the dist directory. */
export async function resolveStaticAsset(
  distDirectory: string | URL,
  pathname: string,
): Promise<{ file: string; relativePath: string } | null> {
  const relativePath = staticAssetRelativePath(pathname);
  if (!relativePath) return null;

  const distPath = resolve(
    distDirectory instanceof URL ? fromFileUrl(distDirectory) : distDirectory,
  );
  const candidate = resolve(distPath, relativePath);
  if (!isWithin(distPath, candidate)) return null;

  try {
    const distStat = await Deno.lstat(distPath);
    if (distStat.isSymlink || !distStat.isDirectory) return null;
    const [realDistPath, realCandidate] = await Promise.all([
      Deno.realPath(distPath),
      Deno.realPath(candidate),
    ]);
    if (!isWithin(realDistPath, realCandidate)) return null;
    return { file: realCandidate, relativePath };
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) return null;
    throw error;
  }
}

export function staticContentType(relativePath: string): string {
  const extension = relativePath.slice(relativePath.lastIndexOf("."));
  return CONTENT_TYPES.get(extension) ?? "application/octet-stream";
}
