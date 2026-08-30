import type { CodingAgent } from "./coding_agent.ts";

type Environment = Record<string, string | undefined>;
type OperatingSystem = typeof Deno.build.os;

const COMMON_VARIABLES = [
  "PATH",
  "PATHEXT",
  "HOME",
  "USERPROFILE",
  "HOMEDRIVE",
  "HOMEPATH",
  "APPDATA",
  "LOCALAPPDATA",
  "SystemRoot",
  "SYSTEMROOT",
  "ComSpec",
  "COMSPEC",
  "TEMP",
  "TMP",
  "TMPDIR",
  "XDG_CONFIG_HOME",
  "XDG_CACHE_HOME",
  "XDG_DATA_HOME",
  "DENO_DIR",
  "LANG",
  "LC_ALL",
  "LC_CTYPE",
  "TERM",
  "COLORTERM",
  "NO_COLOR",
  "SHELL",
  "USER",
  "LOGNAME",
  "HTTP_PROXY",
  "HTTPS_PROXY",
  "NO_PROXY",
  "http_proxy",
  "https_proxy",
  "no_proxy",
  "SSL_CERT_FILE",
  "SSL_CERT_DIR",
] as const;

const AGENT_VARIABLES: Record<CodingAgent, readonly string[]> = {
  codex: [
    "CODEX_HOME",
    "OPENAI_API_KEY",
    "OPENAI_BASE_URL",
    "OPENAI_ORGANIZATION",
    "OPENAI_PROJECT",
    "AZURE_OPENAI_API_KEY",
    "AZURE_OPENAI_ENDPOINT",
    "AZURE_OPENAI_API_VERSION",
  ],
  claude: [
    "CLAUDE_CONFIG_DIR",
    "ANTHROPIC_API_KEY",
    "ANTHROPIC_AUTH_TOKEN",
    "ANTHROPIC_BASE_URL",
    "CLAUDE_CODE_USE_BEDROCK",
    "CLAUDE_CODE_USE_VERTEX",
    "AWS_ACCESS_KEY_ID",
    "AWS_SECRET_ACCESS_KEY",
    "AWS_SESSION_TOKEN",
    "AWS_REGION",
    "AWS_PROFILE",
    "GOOGLE_APPLICATION_CREDENTIALS",
    "CLOUD_ML_REGION",
    "ANTHROPIC_VERTEX_PROJECT_ID",
  ],
  opencode: [
    "OPENCODE_CONFIG",
    "OPENCODE_CONFIG_DIR",
    "OPENAI_API_KEY",
    "ANTHROPIC_API_KEY",
    "GOOGLE_GENERATIVE_AI_API_KEY",
    "GEMINI_API_KEY",
    "OPENROUTER_API_KEY",
    "GROQ_API_KEY",
    "MISTRAL_API_KEY",
    "XAI_API_KEY",
    "DEEPSEEK_API_KEY",
    "AWS_ACCESS_KEY_ID",
    "AWS_SECRET_ACCESS_KEY",
    "AWS_SESSION_TOKEN",
    "AWS_REGION",
    "AWS_PROFILE",
    "GOOGLE_APPLICATION_CREDENTIALS",
  ],
};

const MATCH_VARIABLES = new Set([
  "AGENT_NAME",
  "MATCH_MODE",
  "AI_NAME",
  "AI_BOARD",
  "KAKOMIMASU_HOST",
  "BEARER_TOKEN",
  "GAME_ID",
]);

/** Build a fresh environment instead of inheriting the match process secrets. */
export function baseCommandEnvironment(
  parent: Environment,
  os: OperatingSystem = Deno.build.os,
): Record<string, string> {
  const result: Record<string, string> = {};
  copyEnvironmentVariables(result, parent, COMMON_VARIABLES, os);
  return result;
}

function environmentEntry(
  parent: Environment,
  name: string,
  os: OperatingSystem,
): [string, string] | undefined {
  const direct = parent[name];
  if (direct !== undefined) return [name, direct];
  if (os !== "windows") return undefined;
  const matchingName = Object.keys(parent).find((candidate) =>
    candidate.toUpperCase() === name.toUpperCase()
  );
  if (matchingName === undefined) return undefined;
  const value = parent[matchingName];
  return value === undefined ? undefined : [matchingName, value];
}

function copyEnvironmentVariables(
  result: Record<string, string>,
  parent: Environment,
  names: readonly string[],
  os: OperatingSystem,
): void {
  const seen = new Set(
    Object.keys(result).map((name) => os === "windows" ? name.toUpperCase() : name),
  );
  for (const name of names) {
    const entry = environmentEntry(parent, name, os);
    if (!entry) continue;
    const [parentName, value] = entry;
    const key = os === "windows" ? parentName.toUpperCase() : parentName;
    if (seen.has(key)) continue;
    seen.add(key);
    result[parentName] = value;
  }
}

export function codingAgentEnvironment(
  agent: CodingAgent,
  parent: Environment,
  overrides: Record<string, string> = {},
  os: OperatingSystem = Deno.build.os,
): Record<string, string> {
  const result = baseCommandEnvironment(parent, os);
  copyEnvironmentVariables(result, parent, AGENT_VARIABLES[agent], os);
  for (const [name, value] of Object.entries(overrides)) {
    if (MATCH_VARIABLES.has(os === "windows" ? name.toUpperCase() : name)) {
      throw new Error(`コーディングAIへ渡せない環境変数です: ${name}`);
    }
    if (os === "windows") {
      const existingName = Object.keys(result).find((candidate) =>
        candidate.toUpperCase() === name.toUpperCase()
      );
      if (existingName !== undefined) delete result[existingName];
    }
    result[name] = value;
  }
  return result;
}
