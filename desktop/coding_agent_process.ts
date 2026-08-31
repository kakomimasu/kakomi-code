import { type CodingAgent, type CodingAgentCommand } from "./coding_agent.ts";
import { baseCommandEnvironment, codingAgentEnvironment } from "./coding_agent_environment.ts";
import { CodingAgentOutput, createStructuredOutputState } from "./coding_agent_output.ts";
import {
  attachCodingAgentProcess,
  type CodingAgentRun,
  detachCodingAgentProcess,
} from "./coding_agent_run.ts";
import { captureOutput } from "./process_output.ts";
import { spawnProcessTree } from "./process_tree.ts";

export type CodingAgentRunResult = {
  cancelled: boolean;
  output: string;
};

export type CodingAgentValidationResult = {
  cancelled: boolean;
  stdout: string;
  stderr: string;
  success: boolean;
};

async function writeInput(process: Deno.ChildProcess, input: string): Promise<void> {
  const writer = process.stdin.getWriter();
  try {
    await writer.write(new TextEncoder().encode(input));
    await writer.close();
  } finally {
    writer.releaseLock();
  }
}

export class CodingAgentProcess {
  constructor(private readonly output: CodingAgentOutput) {}

  async runValidation(
    command: string,
    args: string[],
    cwd: string,
    run: CodingAgentRun,
    logStdout = true,
  ): Promise<CodingAgentValidationResult> {
    if (run.stopRequested) return { cancelled: true, stdout: "", stderr: "", success: false };
    const process = spawnProcessTree(command, {
      args,
      cwd,
      clearEnv: true,
      env: baseCommandEnvironment(Deno.env.toObject()),
      stdin: "null",
      stdout: "piped",
      stderr: "piped",
    });
    if (!attachCodingAgentProcess(run, process)) {
      return { cancelled: true, stdout: "", stderr: "", success: false };
    }
    try {
      const [stdout, stderr, status] = await Promise.all([
        captureOutput(
          process.stdout,
          "stdout",
          logStdout ? (message) => this.output.addStatus(message) : () => {},
        ),
        captureOutput(process.stderr, "stderr", (message) => this.output.addStatus(message)),
        process.status,
      ]);
      return { cancelled: run.stopRequested, stdout, stderr, success: status.success };
    } finally {
      detachCodingAgentProcess(run, process);
    }
  }

  async run(
    command: string,
    specification: CodingAgentCommand,
    agent: CodingAgent,
    run: CodingAgentRun,
  ): Promise<CodingAgentRunResult> {
    if (run.stopRequested) return { cancelled: true, output: "" };
    this.output.addStatus(
      `$ ${specification.commandName} ${specification.loggedArgs.join(" ")}`,
    );
    const process = spawnProcessTree(command, {
      args: specification.args,
      cwd: specification.cwd,
      clearEnv: true,
      env: codingAgentEnvironment(agent, Deno.env.toObject(), specification.env),
      stdin: "piped",
      stdout: "piped",
      stderr: "piped",
    });
    if (!attachCodingAgentProcess(run, process)) return { cancelled: true, output: "" };
    this.output.addStatus(`プロセスを開始しました (PID: ${process.pid})。`);
    const structuredOutput = createStructuredOutputState();
    try {
      let inputError: unknown;
      const [stdout, stderr, status] = await Promise.all([
        this.output.captureJson(process.stdout, agent, structuredOutput),
        captureOutput(process.stderr, "stderr", (message) => this.output.addStatus(message)),
        process.status,
        writeInput(process, specification.stdin).catch((error) => {
          inputError = error;
        }),
      ]);
      if (run.stopRequested) return { cancelled: true, output: "" };
      if (!status.success) {
        throw new Error(
          structuredOutput.errorMessage || stderr || structuredOutput.unparsedOutput || stdout ||
            `${command} が正常終了しませんでした。`,
        );
      }
      if (inputError) throw inputError;
      return {
        cancelled: false,
        output: structuredOutput.finalOutput || structuredOutput.unparsedOutput.trim() ||
          "コマンド出力はありません。",
      };
    } finally {
      detachCodingAgentProcess(run, process);
    }
  }
}
