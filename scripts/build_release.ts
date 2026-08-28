import { dirname, extname, join } from "@std/path";

const targets = {
  "aarch64-apple-darwin": {
    extension: ".dmg",
    icon: "desktop/assets/app-icon.icns",
  },
  "x86_64-apple-darwin": {
    extension: ".dmg",
    icon: "desktop/assets/app-icon.icns",
  },
  "x86_64-pc-windows-msvc": { extension: ".msi", icon: "desktop/assets/app-icon.ico" },
  "x86_64-unknown-linux-gnu": {
    extension: ".AppImage",
    icon: "desktop/assets/app-icon-1024.png",
  },
} as const;

type Target = keyof typeof targets;

function optionValue(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index < 0) return undefined;
  return args[index + 1];
}

function usage(): never {
  console.error(
    "使い方: deno task release:build --target <target> --output <release-file>",
  );
  Deno.exit(2);
}

const targetValue = optionValue(Deno.args, "--target");
const output = optionValue(Deno.args, "--output");
if (!targetValue || !output || !(targetValue in targets)) usage();

const target = targetValue as Target;
const config = targets[target];
if (extname(output).toLowerCase() !== config.extension.toLowerCase()) {
  throw new Error(`${target} の出力ファイルには ${config.extension} を指定してください。`);
}

const outputDir = dirname(output);
await Deno.mkdir(outputDir, { recursive: true });
const temporaryDir = await Deno.makeTempDir({ dir: outputDir, prefix: ".release-build-" });
const buildOutput = join(temporaryDir, `KakomiCode${config.extension}`);

const args = [
  "desktop",
  "--frozen",
  "--target",
  target,
  "--output",
  buildOutput,
  "--icon",
  config.icon,
  "--allow-read",
  "--allow-write",
  "--allow-env",
  "--allow-net",
  "--allow-run",
  "--include",
  "desktop/index.html",
  "--include",
  "desktop/style.css",
  "--include",
  "desktop/ui.bundle.js",
  "--include",
  "desktop/assets",
  "--include",
  "template",
  "--include",
  "node_modules/monaco-editor/min",
  "desktop/app.ts",
];

try {
  console.log(`${target} 向けの囲みコードをビルドします…`);
  const status = await new Deno.Command(Deno.execPath(), { args }).spawn().status;
  if (!status.success) throw new Error(`deno desktop が終了コード ${status.code} で失敗しました。`);

  try {
    await Deno.stat(output);
    throw new Error(`出力先は既に存在します: ${output}`);
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) throw error;
  }
  await Deno.rename(buildOutput, output);
  console.log(`ビルドが完了しました: ${output}`);
} finally {
  await Deno.remove(temporaryDir, { recursive: true });
}
