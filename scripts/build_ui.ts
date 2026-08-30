import { dirname, fromFileUrl, join } from "@std/path";

const projectRoot = join(import.meta.dirname ?? "scripts", "..");
const outputRoot = join(projectRoot, "dist");

async function copyDirectory(source: string, destination: string) {
  await Deno.mkdir(destination, { recursive: true });
  for await (const entry of Deno.readDir(source)) {
    const sourcePath = join(source, entry.name);
    const destinationPath = join(destination, entry.name);
    if (entry.isDirectory) await copyDirectory(sourcePath, destinationPath);
    else if (entry.isFile) await Deno.copyFile(sourcePath, destinationPath);
  }
}

await Deno.remove(outputRoot, { recursive: true }).catch((error) => {
  if (!(error instanceof Deno.errors.NotFound)) throw error;
});
await Deno.mkdir(join(outputRoot, "desktop"), { recursive: true });

const bundle = new Deno.Command(Deno.execPath(), {
  args: [
    "bundle",
    "--frozen",
    "--platform",
    "browser",
    "--format",
    "esm",
    "--minify",
    "--output",
    join(outputRoot, "ui.js"),
    join(projectRoot, "desktop", "ui.tsx"),
  ],
});
const status = await bundle.spawn().status;
if (!status.success) {
  throw new Error(`React画面のバンドルに失敗しました（終了コード ${status.code}）。`);
}

await Deno.copyFile(join(projectRoot, "desktop", "index.html"), join(outputRoot, "index.html"));
await Deno.copyFile(
  join(projectRoot, "desktop", "style.css"),
  join(outputRoot, "desktop", "style.css"),
);
await copyDirectory(
  join(projectRoot, "desktop", "assets"),
  join(outputRoot, "desktop", "assets"),
);

let monacoRoot = dirname(fromFileUrl(import.meta.resolve("monaco-editor")));
while (true) {
  try {
    const packageConfig = JSON.parse(await Deno.readTextFile(join(monacoRoot, "package.json")));
    if (packageConfig.name === "monaco-editor") break;
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) throw error;
  }
  const parent = dirname(monacoRoot);
  if (parent === monacoRoot) throw new Error("Monaco Editorの配置を確認できませんでした。");
  monacoRoot = parent;
}
await copyDirectory(join(monacoRoot, "min", "vs"), join(outputRoot, "vs"));
