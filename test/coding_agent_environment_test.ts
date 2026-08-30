import { assertEquals, assertThrows } from "@std/assert";
import { codingAgentEnvironment } from "../desktop/coding_agent_environment.ts";

Deno.test("コーディングAIの環境から対戦用秘密情報を除外する", () => {
  const environment = codingAgentEnvironment(
    "codex",
    {
      PATH: "/bin",
      HOME: "/home/user",
      OPENAI_API_KEY: "agent-key",
      BEARER_TOKEN: "match-secret",
      GAME_ID: "game-secret",
      UNRELATED_SECRET: "other-secret",
    },
  );
  assertEquals(environment, {
    PATH: "/bin",
    HOME: "/home/user",
    OPENAI_API_KEY: "agent-key",
  });
});

Deno.test("コーディングAI固有の安全な設定だけを上書きする", () => {
  assertEquals(
    codingAgentEnvironment("opencode", { PATH: "/bin" }, {
      OPENCODE_CONFIG_CONTENT: '{"plugin":[]}',
    }),
    { PATH: "/bin", OPENCODE_CONFIG_CONTENT: '{"plugin":[]}' },
  );
  assertThrows(
    () => codingAgentEnvironment("claude", {}, { BEARER_TOKEN: "secret" }),
    Error,
    "渡せない環境変数",
  );
});

Deno.test("Windowsの環境変数名は大文字小文字を区別せず引き継ぐ", () => {
  assertEquals(
    codingAgentEnvironment(
      "codex",
      {
        Path: "C:\\Windows\\System32;C:\\Tools",
        SystemRoot: "C:\\Windows",
        openai_api_key: "agent-key",
        Bearer_Token: "match-secret",
      },
      {},
      "windows",
    ),
    {
      Path: "C:\\Windows\\System32;C:\\Tools",
      SystemRoot: "C:\\Windows",
      openai_api_key: "agent-key",
    },
  );
});
