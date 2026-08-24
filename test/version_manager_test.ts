import { assertEquals } from "@std/assert";
import { join } from "@std/path";
import {
  BASE_VERSION_NAME,
  createVersion,
  deleteVersion,
  renameVersion,
} from "../desktop/version_manager.ts";

Deno.test("＋で作る版は1号ではなくtemplate/main.tsをコピーする", async () => {
  const projectDir = await Deno.makeTempDir();
  try {
    const base = join(projectDir, "versions", BASE_VERSION_NAME);
    const template = join(projectDir, "template", "main.ts");
    await Deno.mkdir(base, { recursive: true });
    await Deno.mkdir(join(projectDir, "template"), { recursive: true });
    await Deno.writeTextFile(join(base, "main.ts"), "console.log('edited 1');\n");
    await Deno.writeTextFile(template, "console.log('template');\n");

    const version = await createVersion(projectDir, "新しい版");

    assertEquals(
      await Deno.readTextFile(join(version.path, "main.ts")),
      "console.log('template');\n",
    );
  } finally {
    await Deno.remove(projectDir, { recursive: true });
  }
});

Deno.test("複製した版はAI名をそのまま使い、連番だけを進める", async () => {
  const projectDir = await Deno.makeTempDir();
  try {
    const source = join(projectDir, "versions", BASE_VERSION_NAME);
    await Deno.mkdir(source, { recursive: true });
    await Deno.writeTextFile(join(source, "main.ts"), "console.log('base');\n");

    const version = await createVersion(projectDir, "エルメマス", source);

    assertEquals(version.name, "v002-エルメマス");
    assertEquals(await Deno.readTextFile(join(version.path, "main.ts")), "console.log('base');\n");
  } finally {
    await Deno.remove(projectDir, { recursive: true });
  }
});

Deno.test("最後に残った版も削除できる", async () => {
  const projectDir = await Deno.makeTempDir();
  try {
    const versionDir = join(projectDir, "versions", "v002-エルメマス");
    await Deno.mkdir(versionDir, { recursive: true });
    await Deno.writeTextFile(join(versionDir, "main.ts"), "console.log('base');\n");

    await deleteVersion(projectDir, versionDir);
    await Deno.stat(versionDir).then(
      () => {
        throw new Error("削除された版が残っています。");
      },
      (error) => {
        if (!(error instanceof Deno.errors.NotFound)) throw error;
      },
    );
  } finally {
    await Deno.remove(projectDir, { recursive: true });
  }
});

Deno.test("1号も名前変更と削除ができる", async () => {
  const projectDir = await Deno.makeTempDir();
  try {
    const firstVersion = join(projectDir, "versions", BASE_VERSION_NAME);
    const secondVersion = join(projectDir, "versions", "v002-エルメマス2号");
    await Deno.mkdir(firstVersion, { recursive: true });
    await Deno.mkdir(secondVersion, { recursive: true });
    await Deno.writeTextFile(join(firstVersion, "main.ts"), "console.log('first');\n");
    await Deno.writeTextFile(join(secondVersion, "main.ts"), "console.log('second');\n");

    const renamed = await renameVersion(projectDir, firstVersion, "名前変更後");
    assertEquals(renamed.name, "v001-名前変更後");
    assertEquals(await Deno.readTextFile(join(renamed.path, "main.ts")), "console.log('first');\n");

    await deleteVersion(projectDir, renamed.path);
    await Deno.stat(renamed.path).then(
      () => {
        throw new Error("名前変更した1号が残っています。");
      },
      (error) => {
        if (!(error instanceof Deno.errors.NotFound)) throw error;
      },
    );
  } finally {
    await Deno.remove(projectDir, { recursive: true });
  }
});

Deno.test("名前を変更してもバージョン番号とmain.tsを維持する", async () => {
  const projectDir = await Deno.makeTempDir();
  try {
    const versionDir = join(projectDir, "versions", "v007-変更前");
    await Deno.mkdir(versionDir, { recursive: true });
    await Deno.writeTextFile(join(versionDir, "main.ts"), "console.log('agent');\n");

    const version = await renameVersion(projectDir, versionDir, "変更後");

    assertEquals(version.name, "v007-変更後");
    assertEquals(await Deno.readTextFile(join(version.path, "main.ts")), "console.log('agent');\n");
  } finally {
    await Deno.remove(projectDir, { recursive: true });
  }
});
