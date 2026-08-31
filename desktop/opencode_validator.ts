import { codingAgentCommand } from "./coding_agent.ts";
import { CodingAgentOutput } from "./coding_agent_output.ts";
import { CodingAgentProcess, type CodingAgentRunResult } from "./coding_agent_process.ts";
import type { CodingAgentRun } from "./coding_agent_run.ts";
import { dependencyCheckArgs, dependencyInfoArgs, findExecutable } from "./command_resolver.ts";
import { validateModuleGraph } from "./module_graph.ts";
import { openCodeCorrectionPrompt, validateOpenCodeWorkspace } from "./opencode_adapter.ts";

export class OpenCodeValidator {
  constructor(
    private readonly process: CodingAgentProcess,
    private readonly output: CodingAgentOutput,
    private readonly bundledConfigPath: string,
  ) {}

  async validate(
    command: string,
    workDir: string,
    model: string,
    run: CodingAgentRun,
    initialResult: CodingAgentRunResult,
  ): Promise<CodingAgentRunResult> {
    const denoCommand = await findExecutable("deno");
    if (!denoCommand) throw new Error("Denoが見つからないため、変更を検証できませんでした。");
    let agentResult = initialResult;
    for (let correctionAttempt = 0; correctionAttempt <= 2; correctionAttempt++) {
      if (run.stopRequested) return { cancelled: true, output: "" };
      // Re-check the file size after every correction before Deno materializes it.
      const stagedMain = await validateOpenCodeWorkspace(workDir);
      if (run.stopRequested) return { cancelled: true, output: "" };
      const infoResult = await this.process.runValidation(
        denoCommand,
        dependencyInfoArgs(stagedMain, this.bundledConfigPath),
        workDir,
        run,
        false,
      );
      if (infoResult.cancelled) return { cancelled: true, output: "" };
      if (!infoResult.success) {
        throw new Error("OpenCodeの変更に含まれるimport先を検査できませんでした。");
      }
      await validateModuleGraph(infoResult.stdout, workDir);
      if (run.stopRequested) return { cancelled: true, output: "" };
      const checkResult = await this.process.runValidation(
        denoCommand,
        dependencyCheckArgs(stagedMain, this.bundledConfigPath),
        workDir,
        run,
      );
      if (checkResult.cancelled) return { cancelled: true, output: "" };
      if (checkResult.success) break;

      const checkError = checkResult.stderr || checkResult.stdout ||
        "OpenCodeの変更で型エラーが発生しました。";
      if (correctionAttempt === 2) throw new Error(checkError);
      this.output.addStatus(
        `型エラーをOpenCodeへ返して再修正します（${correctionAttempt + 1}/2）。`,
      );
      const correctionCommand = codingAgentCommand(
        "opencode",
        workDir,
        openCodeCorrectionPrompt(checkError),
        model,
      );
      agentResult = await this.process.run(command, correctionCommand, "opencode", run);
      if (agentResult.cancelled) return agentResult;
    }
    this.output.addStatus("main.tsの型チェックに成功しました。");
    return agentResult;
  }
}
