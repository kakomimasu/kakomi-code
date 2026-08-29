import { dirname, join } from "@std/path";

export type CodingAgent = "codex" | "claude" | "opencode";

export type CodingAgentCommand = {
  commandName: string;
  displayName: string;
  args: string[];
  cwd?: string;
  env?: Record<string, string>;
  loggedArgs: string[];
};

export type OpenCodeEventResult = {
  log?: {
    id: string;
    kind: "message" | "tool" | "status";
    title: string;
    text: string;
    detail?: string;
    status?: string;
  };
  finalOutput?: string;
  errorMessage?: string;
};

export function isCodingAgent(value: unknown): value is CodingAgent {
  return value === "codex" || value === "claude" || value === "opencode";
}

function opencodePermission() {
  return {
    "*": "ask",
    read: "allow",
    edit: "allow",
    bash: "deny",
    glob: "deny",
    grep: "deny",
    list: "deny",
    external_directory: "deny",
    task: "deny",
    subagent: "deny",
    skill: "deny",
    webfetch: "deny",
    websearch: "deny",
    codesearch: "deny",
    execute: "deny",
    lsp: "deny",
    todoread: "deny",
    todowrite: "deny",
    question: "deny",
  } as const;
}

export function opencodeConfig(_versionDir: string): string {
  const permission = opencodePermission();
  return JSON.stringify({
    autoupdate: false,
    share: "disabled",
    plugin: [],
    mcp: {},
    permission,
    agent: {
      build: { permission },
    },
  });
}

export async function createOpenCodeWorkspace(versionDir: string): Promise<string> {
  const workDir = await Deno.makeTempDir({ prefix: "kakomi-opencode-" });
  try {
    await Deno.copyFile(join(versionDir, "main.ts"), join(workDir, "main.ts"));
    return workDir;
  } catch (error) {
    await Deno.remove(workDir, { recursive: true }).catch(() => {});
    throw error;
  }
}

export async function validateOpenCodeWorkspace(workDir: string): Promise<string> {
  const root = await Deno.realPath(workDir);
  const mainFile = await Deno.realPath(join(root, "main.ts"));
  const stat = await Deno.stat(mainFile);
  if (dirname(mainFile) !== root || !stat.isFile) {
    throw new Error("OpenCodeの作業結果が不正です。");
  }
  return mainFile;
}

export function openCodeCorrectionPrompt(typeCheckOutput: string): string {
  return [
    "アプリ側の型チェックで次のエラーが見つかりました。",
    "main.tsだけを修正して、すべてのエラーを解消してください。",
    "コマンドや外部アクセスは使用しないでください。",
    typeCheckOutput.slice(0, 12_000),
  ].join("\n\n");
}

export function parseOpenCodeModels(output: string): Array<{ value: string; label: string }> {
  const seen = new Set<string>();
  const models: Array<{ value: string; label: string }> = [];
  for (const line of output.split(/\r?\n/)) {
    const model = line.trim();
    if (
      !model || model.length > 100 ||
      !/^[A-Za-z0-9][A-Za-z0-9._:/~-]*$/.test(model) || seen.has(model)
    ) continue;
    seen.add(model);
    models.push({ value: model, label: model });
    if (models.length >= 1_000) break;
  }
  return models;
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function printable(value: unknown): string {
  return typeof value === "string" ? value : JSON.stringify(value, null, 2) ?? String(value);
}

export function parseOpenCodeEvent(
  event: Record<string, unknown>,
  fallbackId: string,
): OpenCodeEventResult {
  const eventType = text(event.type);
  const part = record(event.part);
  if ((eventType === "text" || eventType === "reasoning") && part) {
    const message = text(part.text);
    if (!message) return {};
    return {
      log: {
        id: text(part.id) || fallbackId,
        kind: "message",
        title: eventType === "reasoning" ? "思考" : "メッセージ",
        text: message,
      },
      finalOutput: eventType === "text" ? message : undefined,
    };
  }
  if (eventType === "tool_use" && part) {
    const tool = text(part.tool) || "ツール";
    const toolState = record(part.state);
    const input = record(toolState?.input);
    const toolStatus = text(toolState?.status);
    const error = text(toolState?.error);
    return {
      log: {
        id: text(part.id) || fallbackId,
        kind: "tool",
        title: tool === "bash"
          ? "コマンド実行"
          : ["edit", "write", "patch", "apply_patch"].includes(tool)
          ? "ファイル変更"
          : `ツール使用: ${tool}`,
        text: tool === "bash"
          ? text(input?.command) || printable(toolState?.input)
          : printable(toolState?.input),
        detail: error || text(toolState?.output),
        status: toolStatus === "running" || toolStatus === "pending"
          ? "in_progress"
          : toolStatus === "error"
          ? "failed"
          : toolStatus,
      },
      errorMessage: error || undefined,
    };
  }
  if (eventType === "error") {
    const error = record(event.error);
    const message = text(error?.data) || text(error?.message) || text(event.message) ||
      printable(error ?? event);
    return {
      log: { id: fallbackId, kind: "status", title: "エラー", text: message, status: "failed" },
      errorMessage: message,
    };
  }
  return {};
}

export function codingAgentCommand(
  agent: CodingAgent,
  versionDir: string,
  prompt: string,
  model: string,
): CodingAgentCommand {
  const modelArgs = model ? ["--model", model] : [];
  if (agent === "codex") {
    const args = [
      "exec",
      "--json",
      "--sandbox",
      "workspace-write",
      "--config",
      'web_search="disabled"',
      "--cd",
      versionDir,
      ...modelArgs,
      prompt,
    ];
    return {
      commandName: "codex",
      displayName: "Codex CLI",
      args,
      loggedArgs: args.slice(0, -1),
    };
  }
  if (agent === "claude") {
    const args = [
      "-p",
      prompt,
      "--permission-mode",
      "acceptEdits",
      "--tools",
      "Read,Edit,Bash",
      "--allowedTools",
      "Bash(deno check main.ts)",
      "--disallowedTools",
      "WebSearch",
      "--no-chrome",
      "--output-format",
      "stream-json",
      "--verbose",
      ...modelArgs,
    ];
    return {
      commandName: "claude",
      displayName: "Claude Code",
      args,
      cwd: versionDir,
      loggedArgs: [args[0], "…", ...args.slice(2)],
    };
  }

  const args = [
    "run",
    "--format",
    "json",
    "--pure",
    "--agent",
    "build",
    "--dir",
    versionDir,
    ...modelArgs,
    prompt,
  ];
  return {
    commandName: "opencode",
    displayName: "OpenCode",
    args,
    cwd: versionDir,
    env: { OPENCODE_CONFIG_CONTENT: opencodeConfig(versionDir) },
    loggedArgs: args.slice(0, -1),
  };
}
