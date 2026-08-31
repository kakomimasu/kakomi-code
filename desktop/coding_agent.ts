import { opencodeConfig } from "./opencode_adapter.ts";

export const CODING_AGENTS = ["codex", "claude", "opencode"] as const;
export type CodingAgent = typeof CODING_AGENTS[number];

export type CodingAgentCommand = {
  commandName: string;
  displayName: string;
  args: string[];
  stdin: string;
  cwd?: string;
  env?: Record<string, string>;
  loggedArgs: string[];
};

export function isCodingAgent(value: unknown): value is CodingAgent {
  return CODING_AGENTS.some((agent) => agent === value);
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
      "--skip-git-repo-check",
      "--json",
      "--sandbox",
      "workspace-write",
      "--config",
      'web_search="disabled"',
      "--cd",
      versionDir,
      ...modelArgs,
      "-",
    ];
    return {
      commandName: "codex",
      displayName: "Codex CLI",
      args,
      stdin: prompt,
      loggedArgs: args,
    };
  }
  if (agent === "claude") {
    const args = [
      "-p",
      "--input-format",
      "text",
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
      stdin: prompt,
      cwd: versionDir,
      loggedArgs: args,
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
  ];
  return {
    commandName: "opencode",
    displayName: "OpenCode",
    args,
    stdin: prompt,
    cwd: versionDir,
    env: { OPENCODE_CONFIG_CONTENT: opencodeConfig(versionDir) },
    loggedArgs: args,
  };
}
