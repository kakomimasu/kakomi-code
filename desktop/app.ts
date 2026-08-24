import { join } from "@std/path";
import { loadChatHistory, saveChatHistory } from "./chat_history.ts";
import {
  createVersion,
  deleteVersion,
  listVersions,
  renameVersion,
  validateVersion,
} from "./version_manager.ts";

const userHome = Deno.env.get("HOME") ?? Deno.cwd();
const settingsDir = join(userHome, ".kakomimasu-ai-starter");
const projectFile = join(settingsDir, "project-dir.txt");
const chatHistoryFile = join(settingsDir, "chat-history.json");

type Settings = {
  agentName: string;
  aiName: "a1" | "a2" | "a3" | "a4" | "none";
  board: string;
  versionDir: string;
};
type CodingAgent = "codex" | "claude";
type ImproveRequest = { idea: string; versionDir: string; agent: CodingAgent; model: string };

async function defaultProjectDir(): Promise<string> {
  try {
    const saved = (await Deno.readTextFile(projectFile)).trim();
    await Deno.stat(join(saved, "versions"));
    return saved;
  } catch { /* 初回は実行位置から推測する */ }
  const candidates = [
    Deno.cwd(),
    Deno.execPath().replace(/\/[^/]+\.app\/Contents\/MacOS\/[^/]+$/, ""),
  ];
  for (const candidate of candidates) {
    try {
      await Deno.stat(join(candidate, "versions"));
      return candidate;
    } catch { /* 次の候補へ */ }
  }
  throw new Error("スターターキットのフォルダを自動検出できませんでした。");
}

async function saveProjectDir(projectDir: string) {
  await Deno.mkdir(settingsDir, { recursive: true });
  await Deno.writeTextFile(projectFile, projectDir);
}

function validateSettings(value: unknown): Omit<Settings, "versionDir"> & { versionDir: string } {
  if (!value || typeof value !== "object") throw new Error("設定が不正です。");
  const { agentName, aiName, board, versionDir } = value as Record<string, unknown>;
  if (
    typeof agentName !== "string" || !agentName.trim() || agentName.length > 40 ||
    /[\r\n]/.test(agentName)
  ) {
    throw new Error("AI名は1〜40文字で入力してください。");
  }
  if (!["a1", "a2", "a3", "a4", "none"].includes(String(aiName))) {
    throw new Error("練習相手を選択してください。");
  }
  if (typeof board !== "string" || !board.trim() || /[\r\n]/.test(board)) {
    throw new Error("盤面を選択してください。");
  }
  if (typeof versionDir !== "string" || !versionDir) {
    throw new Error("バージョンを選択してください。");
  }
  return {
    agentName: agentName.trim(),
    aiName: aiName as Settings["aiName"],
    board: board.trim(),
    versionDir,
  };
}

function validateImprove(value: unknown): ImproveRequest {
  if (!value || typeof value !== "object") throw new Error("改善依頼が不正です。");
  const { idea, versionDir, agent, model } = value as Record<string, unknown>;
  if (typeof idea !== "string" || !idea.trim()) {
    throw new Error("作戦のアイデアを入力してください。");
  }
  if (typeof versionDir !== "string" || !versionDir) {
    throw new Error("バージョンを選択してください。");
  }
  if (agent !== "codex" && agent !== "claude") {
    throw new Error("コーディングAIを選択してください。");
  }
  if (
    model !== undefined &&
    (typeof model !== "string" || model.trim().length > 100 ||
      (model.trim() && !/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(model.trim())))
  ) {
    throw new Error(
      "モデルIDは英数字、ピリオド、ハイフン、アンダースコア、コロンで入力してください。",
    );
  }
  return {
    idea: idea.trim(),
    versionDir,
    agent,
    model: typeof model === "string" ? model.trim() : "",
  };
}

async function dashboard(projectDir: string) {
  const versions = await listVersions(projectDir);
  return {
    projectDir,
    versions: versions.filter((version) => version.ready),
  };
}

const projectDir = await defaultProjectDir();
await saveProjectDir(projectDir);
// Deno Desktop exposes BrowserWindow at runtime, but the stable Deno type library
// does not include this experimental API yet.
// @ts-expect-error Deno Desktop experimental API
const window = new Deno.BrowserWindow({
  title: "囲みコード",
  width: 1440,
  height: 900,
});
const matchLogs: string[] = [];
type CodingAgentLog = {
  id: string;
  kind: "message" | "tool" | "status";
  title: string;
  text: string;
  detail?: string;
  status?: string;
};

type StructuredOutputState = {
  buffer: string;
  rawOutput: string;
  unparsedOutput: string;
  finalOutput: string;
  errorMessage: string;
  lineNumber: number;
};

const codingAgentLogs: CodingAgentLog[] = [];
const codingAgentLogIndexes = new Map<string, number>();
let codingAgentStatusId = 0;
let codingAgentVersionDir = "";
let codingAgentProcess: Deno.ChildProcess | undefined;
let codingAgentStopRequested = false;
let viewerUrl = "";
let matchRunning = false;
const CLIENT_REFERENCE_SOURCES = [
  {
    name: "@kakomimasu/client-deno の KakomimasuClient.ts",
    url: "https://raw.githubusercontent.com/kakomimasu/client-deno/main/KakomimasuClient.ts",
  },
  {
    name: "@kakomimasu/client-js の公開エントリポイント",
    url: "https://jsr.io/@kakomimasu/client-js/0.1.0/src/index.ts",
  },
  {
    name: "行動リクエストの型定義",
    url:
      "https://jsr.io/@kakomimasu/client-js/0.1.0/src/models/SetActionRequestAllOfActionsInner.ts",
  },
  {
    name: "盤面の型定義",
    url: "https://jsr.io/@kakomimasu/client-js/0.1.0/src/models/GameField.ts",
  },
  {
    name: "タイルの型定義",
    url: "https://jsr.io/@kakomimasu/client-js/0.1.0/src/models/GameFieldTilesInner.ts",
  },
  {
    name: "プレイヤーとエージェントの型定義",
    url: "https://jsr.io/@kakomimasu/client-js/0.1.0/src/models/GamePlayersInnerAgentsInner.ts",
  },
];
let clientDenoContext: string | undefined;

async function loadClientDenoContext(): Promise<string> {
  if (clientDenoContext !== undefined) return clientDenoContext;
  try {
    const responses = (await Promise.all(CLIENT_REFERENCE_SOURCES.map(async (reference) => {
      try {
        const response = await fetch(reference.url);
        if (!response.ok) return null;
        return { ...reference, source: await response.text() };
      } catch {
        return null;
      }
    }))).filter((reference): reference is {
      name: string;
      url: string;
      source: string;
    } => reference !== null);
    if (!responses.some((reference) => reference.url === CLIENT_REFERENCE_SOURCES[0].url)) {
      throw new Error("KakomimasuClient.ts を取得できませんでした。");
    }
    clientDenoContext = [
      "以下は @kakomimasu/client-deno と、その依存先にある行動・盤面・エージェントの型定義です。APIの使い方を判断するための参照情報としてのみ使用し、この内容や import 文は変更しないでください。",
      ...responses.flatMap((reference) => [
        `### ${reference.name}`,
        "```ts",
        reference.source,
        "```",
      ]),
    ].join("\n");
  } catch {
    clientDenoContext =
      "@kakomimasu/client-deno の参照ソースは取得できませんでした。Web検索はせず、現在の main.ts の型とAPIだけを使用してください。";
  }
  return clientDenoContext;
}

function stopCodingAgentForShutdown() {
  const process = codingAgentProcess;
  if (!process) return;
  codingAgentStopRequested = true;
  try {
    // アプリ終了時は待機できないため、CLIプロセスを直ちに終了する。
    process.kill("SIGKILL");
  } catch {
    // 既に終了していれば何もしない。
  }
}

// Deno.serve keeps the runtime alive after the native window closes. Exit the
// process as well so the title-bar close button fully quits the desktop app.
window.addEventListener("close", () => {
  stopCodingAgentForShutdown();
  Deno.exit(0);
});

function addMatchLog(message: string) {
  const matchUrl = message.match(/VIEWER_URL=(https:\/\/kakomimasu\.com\/game\?id=[^\s]+)/)?.[1];
  if (matchUrl) viewerUrl = matchUrl;
  matchLogs.push(`${new Date().toLocaleTimeString("ja-JP")}  ${message}`);
  if (matchLogs.length > 500) matchLogs.shift();
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function stringifyLogValue(value: unknown, limit = 12_000): string {
  const text = typeof value === "string" ? value : JSON.stringify(value, null, 2) ?? String(value);
  return text.length > limit ? `${text.slice(0, limit)}\n…（長すぎるため省略）` : text;
}

function rebuildCodingAgentLogIndexes() {
  codingAgentLogIndexes.clear();
  codingAgentLogs.forEach((log, index) => codingAgentLogIndexes.set(log.id, index));
}

function upsertCodingAgentLog(log: CodingAgentLog) {
  const existingIndex = codingAgentLogIndexes.get(log.id);
  if (existingIndex !== undefined) {
    codingAgentLogs[existingIndex] = { ...codingAgentLogs[existingIndex], ...log };
    return;
  }
  if (codingAgentLogs.length >= 1_000) {
    codingAgentLogs.shift();
    rebuildCodingAgentLogIndexes();
  }
  codingAgentLogIndexes.set(log.id, codingAgentLogs.length);
  codingAgentLogs.push(log);
}

function addCodingAgentStatus(message: string) {
  const text = message.trimEnd();
  if (!text.trim()) return;
  upsertCodingAgentLog({
    id: `status-${++codingAgentStatusId}`,
    kind: "status",
    title: "CLIの状態",
    text,
  });
}

function resetCodingAgentLogs() {
  codingAgentLogs.splice(0);
  codingAgentLogIndexes.clear();
  codingAgentStatusId = 0;
}

function itemLog(item: Record<string, unknown>, fallbackId: string): CodingAgentLog | null {
  const id = stringValue(item.id) || fallbackId;
  const type = stringValue(item.type);
  if (!type) return null;

  if (type === "agent_message" || type === "reasoning") {
    const text = stringValue(item.text);
    if (!text) return null;
    return {
      id,
      kind: "message",
      title: type === "reasoning" ? "思考" : "メッセージ",
      text,
    };
  }

  if (type === "error") {
    return {
      id,
      kind: "status",
      title: "エラー",
      text: stringValue(item.message) || stringifyLogValue(item),
      status: "failed",
    };
  }

  if (type === "todo_list") {
    const items = Array.isArray(item.items) ? item.items : [];
    const text = items.map((value) => {
      const todo = asRecord(value);
      if (!todo) return stringifyLogValue(value);
      const completed = todo.completed === true ? "✓" : "・";
      return `${completed} ${stringValue(todo.text)}`;
    }).join("\n");
    return {
      id,
      kind: "message",
      title: "タスク計画",
      text: text || "タスクを更新しました。",
    };
  }

  const status = stringValue(item.status);
  switch (type) {
    case "command_execution": {
      const detailParts = [];
      const output = stringValue(item.aggregated_output);
      if (output) detailParts.push(output);
      if (item.exit_code !== undefined) detailParts.push(`終了コード: ${String(item.exit_code)}`);
      return {
        id,
        kind: "tool",
        title: "コマンド実行",
        text: stringValue(item.command) || "コマンド",
        detail: detailParts.join("\n"),
        status,
      };
    }
    case "file_change": {
      const changes = Array.isArray(item.changes) ? item.changes : [];
      const text = changes.map((value) => {
        const change = asRecord(value);
        if (!change) return stringifyLogValue(value);
        return `${stringValue(change.kind) || "変更"}  ${stringValue(change.path)}`;
      }).join("\n");
      return {
        id,
        kind: "tool",
        title: "ファイル変更",
        text: text || "ファイルを変更しました。",
        status,
      };
    }
    case "mcp_tool_call":
      return {
        id,
        kind: "tool",
        title: "MCPツール",
        text: [stringValue(item.server), stringValue(item.tool)].filter(Boolean).join(" / ") ||
          "MCPツール",
        detail: item.error
          ? stringifyLogValue(item.error)
          : item.result
          ? stringifyLogValue(item.result)
          : item.arguments !== undefined
          ? `引数:\n${stringifyLogValue(item.arguments)}`
          : "",
        status,
      };
    case "web_search":
      return {
        id,
        kind: "tool",
        title: "Web検索",
        text: stringValue(item.query) || "検索",
        status,
      };
    case "collab_tool_call":
      return {
        id,
        kind: "tool",
        title: "サブエージェント",
        text: stringValue(item.tool) || "サブエージェントを使用",
        detail: item.prompt === null || item.prompt === undefined
          ? ""
          : stringifyLogValue(item.prompt),
        status,
      };
    default:
      return {
        id,
        kind: "tool",
        title: `ツール: ${type}`,
        text: stringifyLogValue(item),
        status,
      };
  }
}

function contentBlocks(event: Record<string, unknown>): Record<string, unknown>[] {
  const message = asRecord(event.message);
  const content = message?.content ?? event.content;
  if (typeof content === "string") return [{ type: "text", text: content }];
  return Array.isArray(content)
    ? content.map(asRecord).filter((value): value is Record<string, unknown> => value !== null)
    : [];
}

function handleCodexEvent(event: Record<string, unknown>, state: StructuredOutputState) {
  const eventType = stringValue(event.type);
  const item = asRecord(event.item);
  if (item && eventType.startsWith("item.")) {
    const log = itemLog(item, `${eventType}-${++state.lineNumber}`);
    if (log) {
      upsertCodingAgentLog(log);
      if (eventType === "item.completed" && item.type === "agent_message") {
        state.finalOutput = log.text;
      }
    }
    if (item.type === "error") state.errorMessage = stringValue(item.message);
    return;
  }
  if (eventType === "turn.failed" || eventType === "error") {
    const error = asRecord(event.error);
    state.errorMessage = stringValue(event.message) || stringValue(error?.message);
    if (state.errorMessage) addCodingAgentStatus(state.errorMessage);
  }
}

function handleClaudeEvent(event: Record<string, unknown>, state: StructuredOutputState) {
  const eventType = stringValue(event.type);
  if (eventType === "assistant") {
    const eventId = stringValue(event.uuid) || `assistant-${++state.lineNumber}`;
    contentBlocks(event).forEach((block, index) => {
      const blockType = stringValue(block.type);
      if (blockType === "text") {
        const text = stringValue(block.text);
        if (text) {
          upsertCodingAgentLog({
            id: `${eventId}-message-${index}`,
            kind: "message",
            title: "メッセージ",
            text,
          });
        }
      } else if (blockType === "tool_use") {
        const toolName = stringValue(block.name) || "ツール";
        upsertCodingAgentLog({
          id: stringValue(block.id) || `${eventId}-tool-${index}`,
          kind: "tool",
          title: `ツール使用: ${toolName}`,
          text: block.input === undefined ? "" : stringifyLogValue(block.input),
          status: "in_progress",
        });
      }
    });
    return;
  }
  if (eventType === "user") {
    contentBlocks(event).forEach((block) => {
      if (stringValue(block.type) !== "tool_result") return;
      const id = stringValue(block.tool_use_id) || `tool-result-${++state.lineNumber}`;
      const existing = codingAgentLogs.find((log) => log.id === id);
      upsertCodingAgentLog({
        id,
        kind: "tool",
        title: existing?.title || "ツール使用",
        text: existing?.text || "",
        detail: block.content === undefined ? "" : stringifyLogValue(block.content),
        status: block.is_error === true ? "failed" : "completed",
      });
    });
    return;
  }
  if (eventType === "result") {
    const result = stringValue(event.result);
    if (result) state.finalOutput = result;
    if (stringValue(event.subtype) !== "success" && result) {
      state.errorMessage = result;
    }
    return;
  }
  if (eventType === "system" && stringValue(event.subtype) === "permission_denied") {
    const id = stringValue(event.tool_use_id) || `permission-${++state.lineNumber}`;
    upsertCodingAgentLog({
      id,
      kind: "tool",
      title: `ツール使用: ${stringValue(event.tool_name) || "ツール"}`,
      text: "",
      detail: stringValue(event.message) || "権限が拒否されました。",
      status: "failed",
    });
  }
}

async function captureCodingAgentJson(
  stream: ReadableStream<Uint8Array>,
  agent: CodingAgent,
  state: StructuredOutputState,
): Promise<string> {
  const decoder = new TextDecoder();
  const handleLine = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    try {
      const event = JSON.parse(trimmed);
      const record = asRecord(event);
      if (!record) throw new Error("JSONイベントがオブジェクトではありません。");
      if (agent === "codex") handleCodexEvent(record, state);
      else handleClaudeEvent(record, state);
    } catch {
      state.unparsedOutput += `${trimmed}\n`;
      addCodingAgentStatus(trimmed);
    }
  };
  for await (const chunk of stream) {
    const text = decoder.decode(chunk, { stream: true });
    state.rawOutput += text;
    state.buffer += text;
    const lines = state.buffer.split(/\r?\n/);
    state.buffer = lines.pop() || "";
    lines.forEach(handleLine);
  }
  const remaining = decoder.decode();
  state.rawOutput += remaining;
  state.buffer += remaining;
  if (state.buffer) handleLine(state.buffer);
  return state.rawOutput;
}

async function captureOutput(
  stream: ReadableStream<Uint8Array>,
  label: "stdout" | "stderr",
  onChunk: (message: string) => void = addMatchLog,
): Promise<string> {
  const decoder = new TextDecoder();
  let output = "";
  for await (const chunk of stream) {
    const text = decoder.decode(chunk, { stream: true });
    output += text;
    if (text) onChunk(`[${label}] ${text}`);
  }
  const remaining = decoder.decode();
  output += remaining;
  if (remaining) onChunk(`[${label}] ${remaining}`);
  return output;
}

type ApiHandler = (...args: unknown[]) => unknown | Promise<unknown>;
const apiHandlers = new Map<string, ApiHandler>();
function expose(name: string, handler: ApiHandler) {
  apiHandlers.set(name, handler);
  window.bind(name, handler);
}

expose("getDashboard", () => dashboard(projectDir));
expose("getChatHistory", () => loadChatHistory(chatHistoryFile));
expose("saveChatHistory", async (history: unknown) => {
  await saveChatHistory(chatHistoryFile, history);
  return { message: "チャット履歴を保存しました。" };
});
expose("getMatchLogs", () => ({ logs: matchLogs, viewerUrl, running: matchRunning }));
expose("getCodingAgentLogs", () => ({
  logs: codingAgentLogs,
  versionDir: codingAgentVersionDir,
}));
expose("stopCodingAgent", () => {
  const process = codingAgentProcess;
  if (!process) return { stopped: false, message: "停止できるコーディングAIはありません。" };
  codingAgentStopRequested = true;
  try {
    process.kill("SIGTERM");
  } catch {
    if (codingAgentProcess === process) codingAgentStopRequested = false;
    return { stopped: false, message: "コーディングAIはすでに終了処理中です。" };
  }
  addCodingAgentStatus("停止を要求しました。");
  setTimeout(() => {
    if (codingAgentProcess !== process || !codingAgentStopRequested) return;
    try {
      process.kill("SIGKILL");
      addCodingAgentStatus("停止を強制しました。");
    } catch {
      // 既に終了していれば何もしない。
    }
  }, 3_000);
  return { stopped: true, message: "コーディングAIの停止を要求しました。" };
});
expose("getSource", async (versionDir: unknown) => {
  if (typeof versionDir !== "string" || !versionDir) {
    throw new Error("バージョンを選択してください。");
  }
  const target = await validateVersion(projectDir, versionDir);
  return await Deno.readTextFile(join(target, "main.ts"));
});
expose("saveSource", async (versionDir: unknown, source: unknown) => {
  if (typeof versionDir !== "string" || !versionDir) {
    throw new Error("バージョンを選択してください。");
  }
  if (typeof source !== "string" || !source.trim()) {
    throw new Error("ソースを入力してください。");
  }
  const target = await validateVersion(projectDir, versionDir);
  await Deno.writeTextFile(join(target, "main.ts"), source);
  return { message: "main.tsを保存しました。" };
});
expose("createVersion", async (label: unknown) => {
  const request = typeof label === "string"
    ? { agentName: label }
    : label as Record<string, unknown>;
  if (!request || typeof request.agentName !== "string" || !request.agentName.trim()) {
    throw new Error("AI名を入力してください。");
  }
  if (request.agentName.trim().length > 40) throw new Error("AI名は40文字以内で入力してください。");
  if (request.sourceVersion !== undefined && typeof request.sourceVersion !== "string") {
    throw new Error("コピー元のバージョンが不正です。");
  }
  const version = await createVersion(projectDir, request.agentName, request.sourceVersion);
  return { version, dashboard: await dashboard(projectDir) };
});

expose("renameVersion", async (value: unknown) => {
  if (!value || typeof value !== "object") throw new Error("名前変更の内容が不正です。");
  const { versionDir, agentName } = value as Record<string, unknown>;
  if (typeof versionDir !== "string" || !versionDir) {
    throw new Error("バージョンを選択してください。");
  }
  if (
    typeof agentName !== "string" || !agentName.trim() || agentName.trim().length > 40 ||
    /[\r\n]/.test(agentName)
  ) {
    throw new Error("AI名は1〜40文字で入力してください。");
  }
  const version = await renameVersion(projectDir, versionDir, agentName);
  return { version, dashboard: await dashboard(projectDir) };
});

expose("deleteVersion", async (versionDir: unknown) => {
  if (typeof versionDir !== "string" || !versionDir) {
    throw new Error("バージョンを選択してください。");
  }
  await deleteVersion(projectDir, versionDir);
  return { versions: await listVersions(projectDir) };
});

expose("startMatch", async (value: unknown) => {
  if (matchRunning) throw new Error("すでに対戦中です。終了を待ってから次の対戦を始めてください。");
  const settings = validateSettings(value);
  const versionDir = await validateVersion(projectDir, settings.versionDir);
  Deno.env.set("AGENT_NAME", settings.agentName);
  Deno.env.set("MATCH_MODE", "ai");
  Deno.env.set("AI_NAME", settings.aiName);
  Deno.env.set("AI_BOARD", settings.board);

  matchLogs.splice(0);
  viewerUrl = "";
  addMatchLog(`main.ts ${versionDir.split("/").at(-1) ?? versionDir} を起動します。`);
  const process = new Deno.Command("deno", {
    args: ["run", "-A", join(versionDir, "main.ts")],
    cwd: versionDir,
    stdout: "piped",
    stderr: "piped",
  }).spawn();
  matchRunning = true;
  // 対戦出力は対戦タブだけに表示し、コーディングAIのチャットログへ混ぜない。
  void Promise.all([
    captureOutput(process.stdout, "stdout", addMatchLog),
    captureOutput(process.stderr, "stderr", addMatchLog),
    process.status,
  ]).then(([, , status]) => {
    matchRunning = false;
    addMatchLog(
      status.success ? "対戦クライアントが終了しました。" : "対戦クライアントが異常終了しました。",
    );
  }).catch((error) => {
    matchRunning = false;
    addMatchLog(`対戦クライアントの出力取得に失敗しました: ${error}`);
  });
  return {
    message: "main.tsを起動しました。対局の準備ができると、対戦画面へのリンクが表示されます。",
    viewerUrl,
  };
});

expose("improveWithAgent", async (value: unknown) => {
  const request = validateImprove(value);
  const versionDir = await validateVersion(projectDir, request.versionDir);
  codingAgentVersionDir = versionDir;
  const clientContext = await loadClientDenoContext();
  const prompt = [
    "囲みマス初心者向けスターターキットの作戦を改善してください。",
    "現在の作業ディレクトリが、この改善専用のバージョンです。親や別バージョンへ移動しないでください。",
    "編集してよいのは main.ts だけです。",
    "Web検索、ブラウザ、外部サイトや外部APIへのアクセスは使用禁止です。ローカルの main.ts と、この後に示すクライアントの参照ソースだけを根拠に作戦を改善してください。",
    "公開APIを維持し、実装後に deno check main.ts を実行してください。",
    clientContext,
    "作戦のアイデア:",
    request.idea,
  ].join("\n\n");
  const command = request.agent === "codex" ? "codex" : "claude";
  const modelArgs = request.model ? ["--model", request.model] : [];
  const args = request.agent === "codex"
    ? [
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
    ]
    : [
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
  resetCodingAgentLogs();
  const loggedArgs = request.agent === "codex"
    ? args.slice(0, -1)
    : [args[0], "…", ...args.slice(2)];
  addCodingAgentStatus(`$ ${command} ${loggedArgs.join(" ")}`);
  const process = new Deno.Command(command, {
    args,
    cwd: request.agent === "claude" ? versionDir : undefined,
    stdout: "piped",
    stderr: "piped",
  }).spawn();
  codingAgentProcess = process;
  codingAgentStopRequested = false;
  addCodingAgentStatus(`プロセスを開始しました (PID: ${process.pid})。`);
  const structuredOutput: StructuredOutputState = {
    buffer: "",
    rawOutput: "",
    unparsedOutput: "",
    finalOutput: "",
    errorMessage: "",
    lineNumber: 0,
  };
  try {
    const [stdout, stderr, status] = await Promise.all([
      captureCodingAgentJson(process.stdout, request.agent, structuredOutput),
      captureOutput(process.stderr, "stderr", addCodingAgentStatus),
      process.status,
    ]);
    if (codingAgentStopRequested) {
      addCodingAgentStatus("停止しました。");
      return {
        cancelled: true,
        message: "コーディングAIを停止しました。",
        output: "コーディングAIを停止しました。",
      };
    }
    if (!status.success) {
      throw new Error(
        structuredOutput.errorMessage || stderr || structuredOutput.unparsedOutput || stdout ||
          `${command} が正常終了しませんでした。`,
      );
    }
    addCodingAgentStatus("正常終了しました。");
    const output = structuredOutput.finalOutput || structuredOutput.unparsedOutput.trim() ||
      "コマンド出力はありません。";
    return {
      message: output || `${request.agent === "codex" ? "Codex" : "Claude Code"} が更新しました。`,
      output,
    };
  } finally {
    if (codingAgentProcess === process) codingAgentProcess = undefined;
    codingAgentStopRequested = false;
  }
});

const assets = new Map([
  ["/", ["index.html", "text/html; charset=utf-8"]],
  ["/index.html", ["index.html", "text/html; charset=utf-8"]],
  ["/style.css", ["style.css", "text/css; charset=utf-8"]],
  ["/ui.js", ["ui.js", "text/javascript; charset=utf-8"]],
  ["/alpine.js", ["alpine.js", "text/javascript; charset=utf-8"]],
  ["/assets/codex.webp", ["assets/codex.webp", "image/webp"]],
  ["/assets/claude.svg", ["assets/claude.svg", "image/svg+xml"]],
  ["/assets/app-icon.png", ["assets/app-icon.png", "image/png"]],
]);

Deno.serve(async (request) => {
  const url = new URL(request.url);
  if (request.method === "POST" && url.pathname.startsWith("/api/bindings/")) {
    try {
      const name = decodeURIComponent(url.pathname.slice("/api/bindings/".length));
      const handler = apiHandlers.get(name);
      if (!handler) return Response.json({ error: "APIが見つかりません。" }, { status: 404 });
      const body = await request.json() as { args?: unknown[] };
      const result = await handler(...(Array.isArray(body.args) ? body.args : []));
      return Response.json({ result });
    } catch (error) {
      return Response.json({ error: error instanceof Error ? error.message : String(error) }, {
        status: 400,
      });
    }
  }
  if (url.pathname.startsWith("/monaco/")) {
    let relativePath = "";
    try {
      relativePath = decodeURIComponent(url.pathname.slice("/monaco/".length));
    } catch {
      return new Response("Not found", { status: 404 });
    }
    if (
      !relativePath || relativePath.includes("\\") ||
      relativePath.split("/").some((part) => part === ".." || part === ".")
    ) {
      return new Response("Not found", { status: 404 });
    }
    try {
      const file = new URL(`../node_modules/monaco-editor/min/${relativePath}`, import.meta.url);
      const contentType = relativePath.endsWith(".css")
        ? "text/css; charset=utf-8"
        : "text/javascript; charset=utf-8";
      return new Response(await Deno.readFile(file), {
        headers: { "content-type": contentType },
      });
    } catch {
      return new Response("Not found", { status: 404 });
    }
  }
  const asset = assets.get(url.pathname);
  if (!asset) return new Response("Not found", { status: 404 });
  return new Response(await Deno.readFile(new URL(`./${asset[0]}`, import.meta.url)), {
    headers: { "content-type": asset[1] },
  });
});
