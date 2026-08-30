import { assertRejects } from "@std/assert";
import { join, toFileUrl } from "@std/path";
import { validateModuleGraph } from "../desktop/module_graph.ts";

function graph(...specifiers: string[]): string {
  return JSON.stringify({ modules: specifiers.map((specifier) => ({ specifier })) });
}

Deno.test("対戦用module graphは隔離フォルダーと許可ホストだけを受け入れる", async () => {
  const workspace = await Deno.makeTempDir();
  const main = join(workspace, "main.ts");
  await Deno.writeTextFile(main, "export {};\n");
  try {
    await validateModuleGraph(
      graph(
        toFileUrl(main).href,
        "https://raw.githubusercontent.com/kakomimasu/client-deno/main/KakomimasuClient.ts",
        "https://jsr.io/@kakomimasu/client-js/0.1.0/src/index.ts",
      ),
      workspace,
    );
  } finally {
    await Deno.remove(workspace, { recursive: true });
  }
});

Deno.test("対戦用module graphは隔離フォルダー外の静的importを拒否する", async () => {
  const root = await Deno.makeTempDir();
  const workspace = join(root, "workspace");
  const outside = join(root, "secret.json");
  await Deno.mkdir(workspace);
  await Deno.writeTextFile(outside, "{}\n");
  try {
    await assertRejects(
      () => validateModuleGraph(graph(toFileUrl(outside).href), workspace),
      Error,
      "一時フォルダーの外",
    );
  } finally {
    await Deno.remove(root, { recursive: true });
  }
});

Deno.test("対戦用module graphはnpmと未許可ホストを拒否する", async () => {
  const workspace = await Deno.makeTempDir();
  try {
    await assertRejects(
      () => validateModuleGraph(graph("npm:example@1"), workspace),
      Error,
      "許可されていないimport先",
    );
    await assertRejects(
      () => validateModuleGraph(graph("https://example.com/code.ts"), workspace),
      Error,
      "許可されていないimport先",
    );
  } finally {
    await Deno.remove(workspace, { recursive: true });
  }
});

Deno.test("対戦用module graphは外部を指すsymlink importを拒否する", async () => {
  if (Deno.build.os === "windows") return;
  const root = await Deno.makeTempDir();
  const workspace = join(root, "workspace");
  const outside = join(root, "secret.ts");
  const link = join(workspace, "helper.ts");
  await Deno.mkdir(workspace);
  await Deno.writeTextFile(outside, "export const secret = true;\n");
  await Deno.symlink(outside, link);
  try {
    await assertRejects(
      () => validateModuleGraph(graph(toFileUrl(link).href), workspace),
      Error,
      "一時フォルダーの外",
    );
  } finally {
    await Deno.remove(root, { recursive: true });
  }
});
