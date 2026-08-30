import { assertEquals, assertRejects, assertStringIncludes } from "@std/assert";
import {
  codingAgentCommand,
  createOpenCodeWorkspace,
  isCodingAgent,
  opencodeConfig,
  openCodeCorrectionPrompt,
  parseOpenCodeEvent,
  parseOpenCodeModels,
  validateOpenCodeWorkspace,
} from "../desktop/coding_agent.ts";

Deno.test("OpenCodeをコーディングAIとして受け付ける", () => {
  assertEquals(isCodingAgent("opencode"), true);
  assertEquals(isCodingAgent("other"), false);
});

Deno.test("Codexは隔離した非Gitフォルダでも実行できる", () => {
  const command = codingAgentCommand(
    "codex",
    "/tmp/kakomi-code-agent-example",
    "作戦を改善して",
    "gpt-5.6-luna",
  );
  assertEquals(command.commandName, "codex");
  assertEquals(command.args, [
    "exec",
    "--skip-git-repo-check",
    "--json",
    "--sandbox",
    "workspace-write",
    "--config",
    'web_search="disabled"',
    "--cd",
    "/tmp/kakomi-code-agent-example",
    "--model",
    "gpt-5.6-luna",
    "-",
  ]);
  assertEquals(command.stdin, "作戦を改善して");
  assertEquals(command.loggedArgs.includes("作戦を改善して"), false);
});

Deno.test("Claude Codeはプロンプトをstdinから受け取る", () => {
  const command = codingAgentCommand(
    "claude",
    "/tmp/kakomi-code-agent-example",
    "作戦を改善して",
    "haiku",
  );
  assertEquals(command.cwd, "/tmp/kakomi-code-agent-example");
  assertEquals(command.stdin, "作戦を改善して");
  assertEquals(command.args.slice(0, 3), ["-p", "--input-format", "text"]);
  assertEquals(command.args.includes("作戦を改善して"), false);
  assertEquals(command.loggedArgs.includes("作戦を改善して"), false);
});

Deno.test("OpenCodeは非対話JSONモードで選択中のバージョンを開く", () => {
  const command = codingAgentCommand(
    "opencode",
    "/workspace/versions/v001-sample",
    "作戦を改善して",
    "anthropic/claude-sonnet-4-5",
  );
  assertEquals(command.commandName, "opencode");
  assertEquals(command.cwd, "/workspace/versions/v001-sample");
  assertEquals(command.args, [
    "run",
    "--format",
    "json",
    "--pure",
    "--agent",
    "build",
    "--dir",
    "/workspace/versions/v001-sample",
    "--model",
    "anthropic/claude-sonnet-4-5",
  ]);
  assertEquals(command.stdin, "作戦を改善して");
  assertEquals(command.loggedArgs.includes("作戦を改善して"), false);
  assertEquals(command.args.includes("--auto"), false);
});

Deno.test("長いプロンプトをコマンド引数へ含めない", () => {
  const prompt = "作".repeat(100_000);
  for (const agent of ["codex", "claude", "opencode"] as const) {
    const command = codingAgentCommand(agent, "/tmp/workspace", prompt, "");
    assertEquals(command.stdin, prompt);
    assertEquals(command.args.includes(prompt), false);
    assertEquals(command.loggedArgs.includes(prompt), false);
  }
});

Deno.test("OpenCodeは隔離作業フォルダの読み書きだけを許可する", () => {
  const rawConfig = opencodeConfig("/workspace/versions/v001-sample");
  const config = JSON.parse(rawConfig);
  const permission = config.permission;
  assertEquals(config.autoupdate, false);
  assertEquals(config.share, "disabled");
  assertEquals(config.plugin, []);
  assertEquals(config.mcp, {});
  assertEquals(permission["*"], "ask");
  assertEquals(permission.read, "allow");
  assertEquals(permission.edit, "allow");
  assertEquals(permission.bash, "deny");
  assertEquals(permission.external_directory, "deny");
  assertEquals(permission.webfetch, "deny");
  assertEquals(permission.websearch, "deny");
  assertEquals(permission.task, "deny");
  assertEquals(config.agent.build.permission, permission);
  assertStringIncludes(rawConfig, '"edit":"allow"');
});

Deno.test("OpenCodeの作業は一時フォルダのmain.tsへ隔離する", async () => {
  const versionDir = await Deno.makeTempDir();
  await Deno.writeTextFile(`${versionDir}/main.ts`, "// original\n");
  const workDir = await createOpenCodeWorkspace(versionDir);
  try {
    assertEquals(
      await Deno.readTextFile(await validateOpenCodeWorkspace(workDir)),
      "// original\n",
    );
    assertEquals(
      [...Deno.readDirSync(workDir)].map((entry) => entry.name),
      ["main.ts"],
    );
    await Deno.writeTextFile(`${workDir}/main.ts`, "// changed\n");
    assertEquals(await Deno.readTextFile(`${versionDir}/main.ts`), "// original\n");
  } finally {
    await Deno.remove(workDir, { recursive: true });
    await Deno.remove(versionDir, { recursive: true });
  }
});

Deno.test("OpenCodeの過大なmain.tsは型チェック前に拒否する", async () => {
  const versionDir = await Deno.makeTempDir();
  await Deno.writeTextFile(`${versionDir}/main.ts`, "// original\n");
  const workDir = await createOpenCodeWorkspace(versionDir);
  try {
    await Deno.truncate(`${workDir}/main.ts`, 41);
    await assertRejects(() => validateOpenCodeWorkspace(workDir, 40), Error, "不正");
  } finally {
    await Deno.remove(workDir, { recursive: true });
    await Deno.remove(versionDir, { recursive: true });
  }
});

Deno.test("OpenCodeへ型エラーだけを渡して再修正を依頼する", () => {
  const prompt = openCodeCorrectionPrompt("TS2339: Property filter does not exist");
  assertStringIncludes(prompt, "main.tsだけを修正");
  assertStringIncludes(prompt, "TS2339");
  assertStringIncludes(prompt, "コマンドや外部アクセスは使用しない");
});

Deno.test("OpenCode CLIのモデル一覧を入力候補へ変換する", () => {
  assertEquals(
    parseOpenCodeModels([
      "opencode/gpt-5.6-sol",
      "openrouter/anthropic/claude-sonnet-4.6",
      "opencode/gpt-5.6-sol",
      "不正な モデル",
      "",
    ].join("\n")),
    [
      { value: "opencode/gpt-5.6-sol", label: "opencode/gpt-5.6-sol" },
      {
        value: "openrouter/anthropic/claude-sonnet-4.6",
        label: "openrouter/anthropic/claude-sonnet-4.6",
      },
    ],
  );
});

Deno.test("OpenCodeのJSONイベントを画面用ログへ変換する", () => {
  assertEquals(
    parseOpenCodeEvent({
      type: "text",
      part: { id: "part-1", text: "改善しました。" },
    }, "fallback"),
    {
      log: {
        id: "part-1",
        kind: "message",
        title: "メッセージ",
        text: "改善しました。",
      },
      finalOutput: "改善しました。",
    },
  );
  assertEquals(
    parseOpenCodeEvent({
      type: "tool_use",
      part: {
        id: "part-2",
        tool: "bash",
        state: { status: "completed", input: { command: "deno check main.ts" }, output: "" },
      },
    }, "fallback").log,
    {
      id: "part-2",
      kind: "tool",
      title: "コマンド実行",
      text: "deno check main.ts",
      detail: "",
      status: "completed",
    },
  );
});
