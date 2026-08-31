import { z } from "zod";
import { join } from "@std/path";
import { createAgentWorkspace } from "./agent_workspace.ts";
import {
  DEPENDENCY_IMPORT_PERMISSION,
  dependencyCacheArgs,
  dependencyInfoArgs,
  findExecutable,
} from "./command_resolver.ts";
import { validateModuleGraph } from "./module_graph.ts";
import { parseInput, versionDirectorySchema } from "./input_validation.ts";
import { captureOutput, MAX_LOG_TEXT_CHARACTERS } from "./process_output.ts";
import { stripTerminalSequences } from "./terminal_text.ts";
import { validateVersion } from "./version_manager.ts";

const AGENT_NAME_ERROR = "AI名は1〜40文字で入力してください。";
const BOARD_ERROR = "盤面を選択してください。";
const MATCH_AI_NAMES = ["a1", "a2", "a3", "a4", "none"] as const;

const matchSettingsSchema = z.object({
  agentName: z.string({ error: AGENT_NAME_ERROR })
    .max(40, { error: AGENT_NAME_ERROR })
    .regex(/^[^\r\n]*$/, { error: AGENT_NAME_ERROR })
    .transform((name) => name.trim())
    .refine((name) => name.length > 0, { error: AGENT_NAME_ERROR }),
  aiName: z.enum(MATCH_AI_NAMES, { error: "練習相手を選択してください。" }),
  board: z.string({ error: BOARD_ERROR })
    .regex(/^[^\r\n]*$/, { error: BOARD_ERROR })
    .transform((board) => board.trim())
    .refine((board) => board.length > 0, { error: BOARD_ERROR }),
  versionDir: versionDirectorySchema,
}, { error: "設定が不正です。" });

export type MatchSettings = z.output<typeof matchSettingsSchema>;

type MatchLifecycle = "idle" | "preparing" | "running" | "stopping";

export function validateMatchSettings(value: unknown): MatchSettings {
  return parseInput(matchSettingsSchema, value);
}

export function resolveMatchNetworkTarget(value: string | undefined): string {
  try {
    const host = new URL(value || "https://api.kakomimasu.com");
    if (host.protocol !== "https:" && host.protocol !== "http:") throw new Error();
    return host.host;
  } catch {
    throw new Error("KAKOMIMASU_HOSTにはHTTPまたはHTTPSのURLを指定してください。");
  }
}

export class MatchController {
  readonly logs: string[] = [];
  viewerUrl = "";

  private lifecycle: MatchLifecycle = "idle";
  private process: Deno.ChildProcess | undefined;
  private setupCompletion: Promise<void> | undefined;
  private readonly workspaces = new Set<string>();

  constructor(
    private readonly projectDir: string,
    private readonly bundledConfigPath: string,
  ) {}

  getState() {
    return { logs: this.logs, viewerUrl: this.viewerUrl, running: this.lifecycle !== "idle" };
  }

  async stopForShutdown(): Promise<void> {
    if (this.lifecycle !== "idle") this.lifecycle = "stopping";
    const process = this.process;
    if (process) {
      try {
        process.kill("SIGKILL");
      } catch {
        // 既に終了していれば何もしない。
      }
    }
    await Promise.allSettled([
      ...(process ? [process.status] : []),
      ...(this.setupCompletion ? [this.setupCompletion] : []),
    ]);
    await Promise.all([...this.workspaces].map((workspace) => this.cleanupWorkspace(workspace)));
  }

  stop() {
    if (this.lifecycle === "idle") {
      return { stopped: false, message: "停止できる対戦はありません。" };
    }
    if (this.lifecycle === "stopping") {
      return { stopped: false, message: "対戦はすでに終了処理中です。" };
    }
    this.lifecycle = "stopping";
    const process = this.process;
    if (process) {
      try {
        process.kill("SIGTERM");
      } catch {
        // 終了直後でも停止要求は保持し、次の準備段階へ進ませない。
      }
    }
    this.addLog("対戦の停止を要求しました。");
    if (process) {
      setTimeout(() => {
        if (this.process !== process || this.lifecycle !== "stopping") return;
        try {
          process.kill("SIGKILL");
          this.addLog("対戦を強制停止しました。");
        } catch {
          // 既に終了していれば何もしない。
        }
      }, 3_000);
    }
    return { stopped: true, message: "対戦の停止を要求しました。" };
  }

  async start(value: unknown) {
    if (this.lifecycle !== "idle") {
      throw new Error("すでに対戦中です。終了を待ってから次の対戦を始めてください。");
    }
    const settings = validateMatchSettings(value);
    this.lifecycle = "preparing";
    this.logs.splice(0);
    this.viewerUrl = "";
    let finishMatchSetup = () => {};
    const setupCompletion = new Promise<void>((resolve) => {
      finishMatchSetup = resolve;
    });
    this.setupCompletion = setupCompletion;
    let matchWorkspace: string | undefined;
    let workspaceOwnedByProcess = false;
    try {
      const versionDir = await validateVersion(this.projectDir, settings.versionDir);
      if (this.isStopping()) return this.stoppedResponse();
      Deno.env.set("AGENT_NAME", settings.agentName);
      Deno.env.set("MATCH_MODE", "ai");
      Deno.env.set("AI_NAME", settings.aiName);
      Deno.env.set("AI_BOARD", settings.board);

      const networkTarget = resolveMatchNetworkTarget(Deno.env.get("KAKOMIMASU_HOST"));
      this.addLog(`main.ts ${versionDir.split("/").at(-1) ?? versionDir} を起動します。`);
      const denoCommand = await findExecutable("deno");
      if (this.isStopping()) return this.stoppedResponse();
      if (!denoCommand) {
        throw new Error("Denoが見つかりません。https://deno.com/ からインストールしてください。");
      }
      const workspace = await createAgentWorkspace(versionDir, this.bundledConfigPath);
      matchWorkspace = workspace;
      this.workspaces.add(workspace);
      if (this.isStopping()) return this.stoppedResponse();
      const matchMain = join(workspace, "main.ts");

      this.addLog("import先と依存関係を検査します。");
      const infoResult = await this.runSetupCommand(
        denoCommand,
        dependencyInfoArgs(matchMain),
        workspace,
        false,
      );
      if (this.isStopping()) return this.stoppedResponse();
      if (!infoResult.status.success) {
        throw new Error("import先を検査できませんでした。main.tsのimportを確認してください。");
      }
      await validateModuleGraph(infoResult.stdout, workspace);
      if (this.isStopping()) return this.stoppedResponse();

      this.addLog("依存関係を準備します。");
      const cacheResult = await this.runSetupCommand(
        denoCommand,
        dependencyCacheArgs(matchMain),
        workspace,
        true,
      );
      if (this.isStopping()) return this.stoppedResponse();
      if (!cacheResult.status.success) {
        throw new Error("依存関係を準備できませんでした。インターネット接続を確認してください。");
      }
      const process = new Deno.Command(denoCommand, {
        args: [
          "run",
          "--cached-only",
          "--no-npm",
          "--no-prompt",
          DEPENDENCY_IMPORT_PERMISSION,
          "--config",
          join(workspace, "deno.json"),
          `--allow-read=${workspace}`,
          `--allow-net=${networkTarget}`,
          "--allow-env=AGENT_NAME,MATCH_MODE,AI_NAME,AI_BOARD,KAKOMIMASU_HOST,BEARER_TOKEN,GAME_ID",
          matchMain,
        ],
        cwd: workspace,
        stdout: "piped",
        stderr: "piped",
      }).spawn();
      this.process = process;
      this.lifecycle = "running";
      workspaceOwnedByProcess = true;
      // 対戦出力は対戦タブだけに表示し、コーディングAIのチャットログへ混ぜない。
      void Promise.all([
        captureOutput(process.stdout, "stdout", (message) => this.addLog(message)),
        captureOutput(process.stderr, "stderr", (message) => this.addLog(message)),
        process.status,
      ]).then(([, , status]) => {
        const stopped = this.lifecycle === "stopping";
        if (this.process === process) {
          this.process = undefined;
          this.lifecycle = "idle";
        }
        this.addLog(
          stopped
            ? "対戦を停止しました。"
            : status.success
            ? "対戦クライアントが終了しました。"
            : "対戦クライアントが異常終了しました。",
        );
      }).catch((error) => {
        if (this.process === process) {
          this.process = undefined;
          this.lifecycle = "idle";
        }
        this.addLog(`対戦クライアントの出力取得に失敗しました: ${error}`);
      }).finally(() => this.cleanupWorkspace(workspace));
      return {
        message:
          "main.tsを起動しました。対局の準備ができると、中央上部の「対戦画面」タブを開けます。",
        viewerUrl: this.viewerUrl,
      };
    } finally {
      try {
        if (!workspaceOwnedByProcess) {
          this.process = undefined;
          this.lifecycle = "idle";
          if (matchWorkspace) await this.cleanupWorkspace(matchWorkspace);
        }
      } finally {
        if (this.setupCompletion === setupCompletion) this.setupCompletion = undefined;
        finishMatchSetup();
      }
    }
  }

  private addLog(message: string): void {
    const cleanMessage = stripTerminalSequences(message);
    const matchUrl = cleanMessage.match(
      /VIEWER_URL=(https:\/\/kakomimasu\.com\/game\?id=[^\s]+)/,
    )?.[1];
    if (matchUrl) this.viewerUrl = matchUrl;
    const text = cleanMessage.length > MAX_LOG_TEXT_CHARACTERS
      ? `${cleanMessage.slice(0, MAX_LOG_TEXT_CHARACTERS)}\n…（長すぎるため省略）`
      : cleanMessage;
    this.logs.push(`${new Date().toLocaleTimeString("ja-JP")}  ${text}`);
    if (this.logs.length > 500) this.logs.shift();
  }

  private isStopping(): boolean {
    return this.lifecycle === "stopping";
  }

  private async runSetupCommand(
    command: string,
    args: string[],
    cwd: string,
    logStdout: boolean,
  ): Promise<{ stdout: string; status: Deno.CommandStatus }> {
    const process = new Deno.Command(command, {
      args,
      cwd,
      stdout: "piped",
      stderr: "piped",
    }).spawn();
    this.process = process;
    try {
      const [stdout, , status] = await Promise.all([
        captureOutput(
          process.stdout,
          "stdout",
          logStdout ? (message) => this.addLog(message) : () => {},
        ),
        captureOutput(process.stderr, "stderr", (message) => this.addLog(message)),
        process.status,
      ]);
      return { stdout, status };
    } finally {
      if (this.process === process) this.process = undefined;
    }
  }

  private async cleanupWorkspace(workspace: string): Promise<void> {
    try {
      await Deno.remove(workspace, { recursive: true });
      this.workspaces.delete(workspace);
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) this.workspaces.delete(workspace);
    }
  }

  private stoppedResponse() {
    return { message: "対戦を停止しました。", viewerUrl: "", stopped: true };
  }
}
