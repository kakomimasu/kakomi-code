import { dirname, join } from "@std/path";
import type { CodingAgentLog } from "./coding_agent_log.ts";

const MAX_CODING_AGENT_MAIN_BYTES = 4_000_000;

export type OpenCodeEventResult = {
  log?: CodingAgentLog;
  finalOutput?: string;
  errorMessage?: string;
};

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

export async function validateOpenCodeWorkspace(
  workDir: string,
  maximumBytes = MAX_CODING_AGENT_MAIN_BYTES,
): Promise<string> {
  const root = await Deno.realPath(workDir);
  const mainFile = await Deno.realPath(join(root, "main.ts"));
  const stat = await Deno.stat(mainFile);
  if (dirname(mainFile) !== root || !stat.isFile || stat.size > maximumBytes) {
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
