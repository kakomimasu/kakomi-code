import { assertEquals, assertStringIncludes } from "@std/assert";
import { CodingAgentOutput, createStructuredOutputState } from "../desktop/coding_agent_output.ts";

function jsonStream(events: Record<string, unknown>[]): ReadableStream<Uint8Array> {
  return new Blob([events.map((event) => JSON.stringify(event)).join("\n")]).stream();
}

Deno.test("CodexのJSONイベントを同じIDのログへ集約する", async () => {
  const output = new CodingAgentOutput();
  const state = createStructuredOutputState();

  await output.captureJson(
    jsonStream([
      {
        type: "item.started",
        item: {
          id: "command-1",
          type: "command_execution",
          command: "deno check main.ts",
          status: "in_progress",
        },
      },
      {
        type: "item.completed",
        item: {
          id: "command-1",
          type: "command_execution",
          command: "deno check main.ts",
          aggregated_output: "Check main.ts",
          exit_code: 0,
          status: "completed",
        },
      },
      {
        type: "item.completed",
        item: { id: "message-1", type: "agent_message", text: "改善しました。" },
      },
    ]),
    "codex",
    state,
  );

  assertEquals(output.logs.length, 2);
  assertEquals(output.logs[0], {
    id: "command-1",
    kind: "tool",
    title: "コマンド実行",
    text: "deno check main.ts",
    detail: "Check main.ts\n終了コード: 0",
    status: "completed",
  });
  assertEquals(state.finalOutput, "改善しました。");
});

Deno.test("Claudeのツール開始と結果を同じログへ集約する", async () => {
  const output = new CodingAgentOutput();
  const state = createStructuredOutputState();

  await output.captureJson(
    jsonStream([
      {
        type: "assistant",
        uuid: "message-1",
        message: {
          content: [{ type: "tool_use", id: "tool-1", name: "Read", input: { file: "main.ts" } }],
        },
      },
      {
        type: "user",
        message: {
          content: [{ type: "tool_result", tool_use_id: "tool-1", content: "読み込み完了" }],
        },
      },
      { type: "result", subtype: "success", result: "修正しました。" },
    ]),
    "claude",
    state,
  );

  assertEquals(output.logs.length, 1);
  assertEquals(output.logs[0].id, "tool-1");
  assertEquals(output.logs[0].title, "ツール使用: Read");
  assertStringIncludes(output.logs[0].text, '"file": "main.ts"');
  assertEquals(output.logs[0].detail, "読み込み完了");
  assertEquals(output.logs[0].status, "completed");
  assertEquals(state.finalOutput, "修正しました。");
});

Deno.test("JSONでない出力を状態ログに残し、リセットできる", async () => {
  const output = new CodingAgentOutput();
  const state = createStructuredOutputState();

  await output.captureJson(new Blob(["通常の出力"]).stream(), "opencode", state);

  assertEquals(state.unparsedOutput, "通常の出力\n");
  assertEquals(output.logs[0].kind, "status");
  assertEquals(output.logs[0].text, "通常の出力");

  output.reset();
  assertEquals(output.logs, []);
});
