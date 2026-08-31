import { applyAgentMain, createAgentWorkspace } from "./agent_workspace.ts";
import { type CodingAgent, codingAgentCommand, isCodingAgent } from "./coding_agent.ts";
import { codingAgentEnvironment } from "./coding_agent_environment.ts";
import { CodingAgentOutput } from "./coding_agent_output.ts";
import { CodingAgentProcess } from "./coding_agent_process.ts";
import { CodingAgentReference } from "./coding_agent_reference.ts";
import {
  type CodingAgentRun,
  createCodingAgentRun,
  forceStopCodingAgentRun,
  requestCodingAgentStop,
} from "./coding_agent_run.ts";
import { findExecutable } from "./command_resolver.ts";
import { createOpenCodeWorkspace, parseOpenCodeModels } from "./opencode_adapter.ts";
import { OpenCodeValidator } from "./opencode_validator.ts";
import { captureOutput } from "./process_output.ts";
import { validateVersion } from "./version_manager.ts";

export type ImproveRequest = {
  idea: string;
  versionDir: string;
  agent: CodingAgent;
  model: string;
};

type CodingAgentControllerOptions = {
  projectDir: string;
  bundledConfigPath: string;
  maxSourceCharacters: number;
};

export function validateImproveRequest(value: unknown): ImproveRequest {
  if (!value || typeof value !== "object") throw new Error("改善依頼が不正です。");
  const { idea, versionDir, agent, model } = value as Record<string, unknown>;
  if (typeof idea !== "string" || !idea.trim() || idea.length > 100_000) {
    throw new Error("作戦のアイデアは1〜100,000文字で入力してください。");
  }
  if (typeof versionDir !== "string" || !versionDir) {
    throw new Error("バージョンを選択してください。");
  }
  if (!isCodingAgent(agent)) {
    throw new Error("コーディングAIを選択してください。");
  }
  if (
    model !== undefined &&
    (typeof model !== "string" || model.trim().length > 100 ||
      (model.trim() && !/^[A-Za-z0-9][A-Za-z0-9._:/~-]*$/.test(model.trim())))
  ) {
    throw new Error(
      "モデルIDは英数字、ピリオド、スラッシュ、チルダ、ハイフン、アンダースコア、コロンで入力してください。",
    );
  }
  return {
    idea: idea.trim(),
    versionDir,
    agent,
    model: typeof model === "string" ? model.trim() : "",
  };
}

export function buildImprovementPrompt(request: ImproveRequest, clientContext: string): string {
  return [
    "囲みマス初心者向けスターターキットの作戦を改善してください。",
    "現在の作業ディレクトリが、この改善専用のバージョンです。親や別バージョンへ移動しないでください。",
    "編集してよいのは main.ts だけです。",
    "Web検索、ブラウザ、外部サイトや外部APIへのアクセスは使用禁止です。ローカルの main.ts と、この後に示すクライアントの参照ソースだけを根拠に作戦を改善してください。",
    request.agent === "opencode"
      ? "公開APIを維持してください。型チェックはアプリ側で安全に実行するため、コマンドは実行しないでください。"
      : "公開APIを維持し、実装後に deno check main.ts を実行してください。",
    clientContext,
    "作戦のアイデア:",
    request.idea,
  ].join("\n\n");
}

export class CodingAgentController {
  private readonly output = new CodingAgentOutput();
  private readonly process = new CodingAgentProcess(this.output);
  private readonly reference = new CodingAgentReference();
  private readonly openCodeValidator: OpenCodeValidator;
  private versionDir = "";
  private activeRun: CodingAgentRun | undefined;
  private completion: Promise<void> | undefined;

  constructor(private readonly options: CodingAgentControllerOptions) {
    this.openCodeValidator = new OpenCodeValidator(
      this.process,
      this.output,
      options.bundledConfigPath,
    );
  }

  getState() {
    return { logs: this.output.logs, versionDir: this.versionDir };
  }

  async getOpenCodeModels() {
    const command = await findExecutable("opencode");
    if (!command) return [];
    const process = new Deno.Command(command, {
      args: ["models", "--pure"],
      clearEnv: true,
      env: codingAgentEnvironment("opencode", Deno.env.toObject()),
      stdout: "piped",
      stderr: "piped",
    }).spawn();
    const [stdout, stderr, status] = await Promise.all([
      captureOutput(process.stdout, "stdout", () => {}),
      captureOutput(process.stderr, "stderr", () => {}),
      process.status,
    ]);
    if (!status.success) {
      throw new Error(stderr || "OpenCodeのモデル一覧を取得できませんでした。");
    }
    return parseOpenCodeModels(stdout);
  }

  stop() {
    const run = this.activeRun;
    if (!run) return { stopped: false, message: "停止できるコーディングAIはありません。" };
    if (
      !requestCodingAgentStop(run, {
        onForce: () => {
          if (this.activeRun === run) this.output.addStatus("停止を強制しました。");
        },
      })
    ) {
      return { stopped: false, message: "コーディングAIはすでに終了処理中です。" };
    }
    this.output.addStatus("停止を要求しました。");
    return { stopped: true, message: "コーディングAIの停止を要求しました。" };
  }

  async stopForShutdown(): Promise<void> {
    const run = this.activeRun;
    const completion = this.completion;
    if (run) {
      try {
        // 終了時はCLIとその子孫を直ちに止め、一時フォルダーの削除完了を待つ。
        forceStopCodingAgentRun(run);
      } catch {
        // 既に終了していれば何もしない。
      }
    }
    if (completion) await completion;
  }

  async improve(value: unknown) {
    if (this.activeRun) {
      throw new Error(
        "コーディングAIはすでに実行中です。終了または停止してから再実行してください。",
      );
    }
    const run = createCodingAgentRun();
    let finish = () => {};
    const completion = new Promise<void>((resolve) => {
      finish = resolve;
    });
    this.activeRun = run;
    this.completion = completion;
    try {
      return await this.improveWithRun(value, run);
    } finally {
      if (this.activeRun === run) this.activeRun = undefined;
      if (this.completion === completion) this.completion = undefined;
      finish();
    }
  }

  private async improveWithRun(value: unknown, run: CodingAgentRun) {
    const request = validateImproveRequest(value);
    const versionDir = await validateVersion(this.options.projectDir, request.versionDir);
    this.versionDir = versionDir;
    this.output.reset();
    if (run.stopRequested) return this.cancelledResponse();

    let clientContext: string;
    try {
      clientContext = await this.reference.load(run.abortController.signal);
    } catch (error) {
      if (run.stopRequested) return this.cancelledResponse();
      throw error;
    }
    if (run.stopRequested) return this.cancelledResponse();

    const prompt = buildImprovementPrompt(request, clientContext);
    const initialCommand = codingAgentCommand(
      request.agent,
      versionDir,
      prompt,
      request.model,
    );
    const command = await findExecutable(initialCommand.commandName);
    if (!command) throw new Error(`${initialCommand.displayName}が見つかりません。`);
    if (run.stopRequested) return this.cancelledResponse();

    const workDir = request.agent === "opencode"
      ? await createOpenCodeWorkspace(versionDir)
      : await createAgentWorkspace(versionDir, this.options.bundledConfigPath);
    const agentCommand = codingAgentCommand(request.agent, workDir, prompt, request.model);
    try {
      if (run.stopRequested) return this.cancelledResponse();
      let agentResult = await this.process.run(command, agentCommand, request.agent, run);
      if (agentResult.cancelled) return this.cancelledResponse();
      if (request.agent === "opencode") {
        agentResult = await this.openCodeValidator.validate(
          command,
          workDir,
          request.model,
          run,
          agentResult,
        );
        if (agentResult.cancelled) return this.cancelledResponse();
      }
      if (run.stopRequested) return this.cancelledResponse();
      await applyAgentMain(workDir, versionDir, this.options.maxSourceCharacters);
      this.output.addStatus("main.tsの変更を反映しました。");
      this.output.addStatus("正常終了しました。");
      return {
        message: agentResult.output || `${agentCommand.displayName} が更新しました。`,
        output: agentResult.output,
      };
    } finally {
      await Deno.remove(workDir, { recursive: true }).catch(() => {});
    }
  }

  private cancelledResponse() {
    this.output.addStatus("停止しました。");
    return {
      cancelled: true,
      message: "コーディングAIを停止しました。",
      output: "コーディングAIを停止しました。",
    };
  }
}
