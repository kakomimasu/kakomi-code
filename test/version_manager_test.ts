import { assertEquals, assertRejects, assertThrows } from "@std/assert";
import { join } from "@std/path";
import {
  BASE_VERSION_NAME,
  createVersion,
  deleteVersion,
  initializeProject,
  listVersions,
  normalizeSourceVersion,
  renameVersion,
  validateVersion,
} from "../desktop/version_manager.ts";

Deno.test("コピー元の未指定値は新規作成として扱う", () => {
  assertEquals(normalizeSourceVersion(undefined), undefined);
  assertEquals(normalizeSourceVersion(null), undefined);
  assertEquals(normalizeSourceVersion("/versions/v002-test"), "/versions/v002-test");
  assertThrows(
    () => normalizeSourceVersion(123),
    Error,
    "コピー元のバージョンが不正です。",
  );
});

Deno.test("fresh cloneではtemplateから最初の版を初期化する", async () => {
  const projectDir = await Deno.makeTempDir();
  try {
    await Deno.mkdir(join(projectDir, "template"));
    await Deno.writeTextFile(join(projectDir, "template", "main.ts"), "// template\n");

    await initializeProject(projectDir);

    const versions = await listVersions(projectDir);
    assertEquals(versions.map((version) => version.name), [BASE_VERSION_NAME]);
    assertEquals(await Deno.readTextFile(join(versions[0].path, "main.ts")), "// template\n");
  } finally {
    await Deno.remove(projectDir, { recursive: true });
  }
});

Deno.test("空のversionsが既にある場合は削除済みの版を復元しない", async () => {
  const projectDir = await Deno.makeTempDir();
  try {
    await Deno.mkdir(join(projectDir, "template"));
    await Deno.mkdir(join(projectDir, "versions"));
    await Deno.writeTextFile(join(projectDir, "template", "main.ts"), "// template\n");

    await initializeProject(projectDir);

    assertEquals(await listVersions(projectDir), []);
  } finally {
    await Deno.remove(projectDir, { recursive: true });
  }
});

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

Deno.test("1000以降の版も一覧と連番の対象になる", async () => {
  const projectDir = await Deno.makeTempDir();
  try {
    const source = join(projectDir, "versions", "v1000-長期運用");
    await Deno.mkdir(source, { recursive: true });
    await Deno.writeTextFile(join(source, "main.ts"), "// v1000\n");

    const version = await createVersion(projectDir, "次の版", source);

    assertEquals(version.name, "v1001-次の版");
    assertEquals((await listVersions(projectDir)).map((item) => item.name), [
      "v1000-長期運用",
      "v1001-次の版",
    ]);
  } finally {
    await Deno.remove(projectDir, { recursive: true });
  }
});

Deno.test("999から1000をまたいでもバージョン番号順に並べる", async () => {
  const projectDir = await Deno.makeTempDir();
  try {
    for (const name of ["v1000-千", "v999-九百九十九", "v010-十"]) {
      const versionDir = join(projectDir, "versions", name);
      await Deno.mkdir(versionDir, { recursive: true });
      await Deno.writeTextFile(join(versionDir, "main.ts"), `// ${name}\n`);
    }

    assertEquals((await listVersions(projectDir)).map((version) => version.name), [
      "v010-十",
      "v999-九百九十九",
      "v1000-千",
    ]);
  } finally {
    await Deno.remove(projectDir, { recursive: true });
  }
});

Deno.test("管理対象外のディレクトリを一覧から除外しmain.tsの有無を返す", async () => {
  const projectDir = await Deno.makeTempDir();
  try {
    const versionsDir = join(projectDir, "versions");
    await Deno.mkdir(join(versionsDir, BASE_VERSION_NAME), { recursive: true });
    await Deno.mkdir(join(versionsDir, "v002-準備中"));
    await Deno.mkdir(join(versionsDir, "自由な名前"));
    await Deno.writeTextFile(join(versionsDir, "メモ.txt"), "not a version\n");

    assertEquals(await listVersions(projectDir), [
      {
        name: BASE_VERSION_NAME,
        path: join(versionsDir, BASE_VERSION_NAME),
        ready: false,
      },
      {
        name: "v002-準備中",
        path: join(versionsDir, "v002-準備中"),
        ready: false,
      },
    ]);
  } finally {
    await Deno.remove(projectDir, { recursive: true });
  }
});

Deno.test("テンプレートがないfresh cloneは中途半端なversionsを作らない", async () => {
  const projectDir = await Deno.makeTempDir();
  try {
    await assertRejects(
      () => initializeProject(projectDir),
      Error,
      "新規エージェント用のテンプレートがありません。",
    );
    await assertRejects(() => Deno.stat(join(projectDir, "versions")), Deno.errors.NotFound);
  } finally {
    await Deno.remove(projectDir, { recursive: true });
  }
});

Deno.test("版名のファイル名に使えない文字と空白を安全な名前へ変換する", async () => {
  const projectDir = await Deno.makeTempDir();
  try {
    await Deno.mkdir(join(projectDir, "template"));
    await Deno.writeTextFile(join(projectDir, "template", "main.ts"), "// template\n");

    const sanitized = await createVersion(projectDir, "  危険な/名前?  ");
    const fallback = await createVersion(projectDir, "  ");

    assertEquals(sanitized.name, "v002-危険な-名前");
    assertEquals(fallback.name, "v003-エルメマス");
  } finally {
    await Deno.remove(projectDir, { recursive: true });
  }
});

Deno.test("名前変更では絵文字を途中で分割せず40文字まで保持する", async () => {
  const projectDir = await Deno.makeTempDir();
  try {
    const versionDir = join(projectDir, "versions", "v007-変更前");
    await Deno.mkdir(versionDir, { recursive: true });
    await Deno.writeTextFile(join(versionDir, "main.ts"), "// agent\n");
    const label = `先頭${"🤖".repeat(38)}末尾`;

    const renamed = await renameVersion(projectDir, versionDir, label);

    assertEquals(renamed.name, `v007-${[...label].slice(0, 40).join("")}`);
    assertEquals(renamed.name.includes("�"), false);
  } finally {
    await Deno.remove(projectDir, { recursive: true });
  }
});

Deno.test("名前変更先が存在する場合は元の版を維持する", async () => {
  const projectDir = await Deno.makeTempDir();
  try {
    const source = join(projectDir, "versions", "v007-変更前");
    const destination = join(projectDir, "versions", "v007-使用中");
    await Deno.mkdir(source, { recursive: true });
    await Deno.mkdir(destination);
    await Deno.writeTextFile(join(source, "main.ts"), "// source\n");
    await Deno.writeTextFile(join(destination, "main.ts"), "// destination\n");

    await assertRejects(
      () => renameVersion(projectDir, source, "使用中"),
      Error,
      "同じ名前のバージョンがすでにあります。",
    );
    assertEquals(await Deno.readTextFile(join(source, "main.ts")), "// source\n");
    assertEquals(await Deno.readTextFile(join(destination, "main.ts")), "// destination\n");
  } finally {
    await Deno.remove(projectDir, { recursive: true });
  }
});

Deno.test("versionsの外にある版は検証も削除も拒否する", async () => {
  const projectDir = await Deno.makeTempDir();
  try {
    await Deno.mkdir(join(projectDir, "versions"));
    const outside = join(projectDir, "outside", "v002-外部");
    await Deno.mkdir(outside, { recursive: true });
    await Deno.writeTextFile(join(outside, "main.ts"), "// outside\n");

    await assertRejects(
      () => validateVersion(projectDir, outside),
      Error,
      "versions配下の有効なバージョンを選択してください",
    );
    await assertRejects(
      () => deleteVersion(projectDir, outside),
      Error,
      "versions配下の有効なバージョンを選択してください",
    );
    assertEquals(await Deno.readTextFile(join(outside, "main.ts")), "// outside\n");
  } finally {
    await Deno.remove(projectDir, { recursive: true });
  }
});

Deno.test("versionsルートがsymlinkの場合は外部の一覧と操作を拒否する", async () => {
  const workspace = await Deno.makeTempDir();
  try {
    const projectDir = join(workspace, "project");
    const outsideVersions = join(workspace, "outside-versions");
    const outsideVersion = join(outsideVersions, "v002-外部");
    await Deno.mkdir(join(projectDir, "template"), { recursive: true });
    await Deno.mkdir(outsideVersion, { recursive: true });
    await Deno.writeTextFile(join(projectDir, "template", "main.ts"), "// template\n");
    await Deno.writeTextFile(join(outsideVersion, "main.ts"), "// outside\n");
    await Deno.symlink(outsideVersions, join(projectDir, "versions"));

    for (
      const operation of [
        () => initializeProject(projectDir),
        () => listVersions(projectDir),
        () => createVersion(projectDir, "外部へ作らない"),
        () => validateVersion(projectDir, outsideVersion),
        () => renameVersion(projectDir, outsideVersion, "変更しない"),
        () => deleteVersion(projectDir, outsideVersion),
      ]
    ) {
      await assertRejects(
        operation,
        Error,
        "versionsフォルダーが不正です。",
      );
    }

    assertEquals(await Deno.readTextFile(join(outsideVersion, "main.ts")), "// outside\n");
    assertEquals(
      await Array.fromAsync(Deno.readDir(outsideVersions)).then((entries) =>
        entries.map((entry) => entry.name)
      ),
      ["v002-外部"],
    );
  } finally {
    await Deno.remove(workspace, { recursive: true });
  }
});
