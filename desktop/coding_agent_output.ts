import type { CodingAgent } from "./coding_agent.ts";
import {
  codexItemLog,
  type CodingAgentLog,
  contentBlocks,
  recordValue as asRecord,
  stringifyLogValue,
  stringValue,
} from "./coding_agent_log.ts";
import {
  appendCapturedOutput,
  MAX_CAPTURED_OUTPUT_CHARACTERS,
  MAX_LOG_TEXT_CHARACTERS,
} from "./process_output.ts";
import { parseOpenCodeEvent } from "./opencode_adapter.ts";

export type StructuredOutputState = {
  buffer: string;
  rawOutput: string;
  unparsedOutput: string;
  finalOutput: string;
  errorMessage: string;
  lineNumber: number;
};

export function createStructuredOutputState(): StructuredOutputState {
  return {
    buffer: "",
    rawOutput: "",
    unparsedOutput: "",
    finalOutput: "",
    errorMessage: "",
    lineNumber: 0,
  };
}

export class CodingAgentOutput {
  readonly logs: CodingAgentLog[] = [];
  private readonly logIndexes = new Map<string, number>();
  private statusId = 0;

  reset(): void {
    this.logs.splice(0);
    this.logIndexes.clear();
    this.statusId = 0;
  }

  addStatus(message: string): void {
    const text = stringifyLogValue(message.trimEnd());
    if (!text.trim()) return;
    this.upsertLog({
      id: `status-${++this.statusId}`,
      kind: "status",
      title: "CLIの状態",
      text,
    });
  }

  async captureJson(
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
        if (agent === "codex") this.handleCodexEvent(record, state);
        else if (agent === "claude") this.handleClaudeEvent(record, state);
        else this.handleOpenCodeEvent(record, state);
      } catch {
        state.unparsedOutput = appendCapturedOutput(state.unparsedOutput, `${trimmed}\n`);
        this.addStatus(trimmed);
      }
    };
    for await (const chunk of stream) {
      const text = decoder.decode(chunk, { stream: true });
      state.rawOutput = appendCapturedOutput(state.rawOutput, text);
      state.buffer += text;
      if (state.buffer.length > MAX_CAPTURED_OUTPUT_CHARACTERS) {
        handleLine(`${state.buffer.slice(0, MAX_LOG_TEXT_CHARACTERS)}\n…（長すぎるため省略）`);
        state.buffer = "";
      }
      const lines = state.buffer.split(/\r?\n/);
      state.buffer = lines.pop() || "";
      lines.forEach(handleLine);
    }
    const remaining = decoder.decode();
    state.rawOutput = appendCapturedOutput(state.rawOutput, remaining);
    state.buffer += remaining;
    if (state.buffer) handleLine(state.buffer);
    return state.rawOutput;
  }

  private rebuildLogIndexes(): void {
    this.logIndexes.clear();
    this.logs.forEach((log, index) => this.logIndexes.set(log.id, index));
  }

  private upsertLog(log: CodingAgentLog): void {
    log = {
      ...log,
      text: stringifyLogValue(log.text),
      detail: log.detail === undefined ? undefined : stringifyLogValue(log.detail),
    };
    const existingIndex = this.logIndexes.get(log.id);
    if (existingIndex !== undefined) {
      this.logs[existingIndex] = { ...this.logs[existingIndex], ...log };
      return;
    }
    if (this.logs.length >= 1_000) {
      this.logs.shift();
      this.rebuildLogIndexes();
    }
    this.logIndexes.set(log.id, this.logs.length);
    this.logs.push(log);
  }

  private handleCodexEvent(
    event: Record<string, unknown>,
    state: StructuredOutputState,
  ): void {
    const eventType = stringValue(event.type);
    const item = asRecord(event.item);
    if (item && eventType.startsWith("item.")) {
      const log = codexItemLog(item, `${eventType}-${++state.lineNumber}`);
      if (log) {
        this.upsertLog(log);
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
      if (state.errorMessage) this.addStatus(state.errorMessage);
    }
  }

  private handleClaudeEvent(
    event: Record<string, unknown>,
    state: StructuredOutputState,
  ): void {
    const eventType = stringValue(event.type);
    if (eventType === "assistant") {
      const eventId = stringValue(event.uuid) || `assistant-${++state.lineNumber}`;
      contentBlocks(event).forEach((block, index) => {
        const blockType = stringValue(block.type);
        if (blockType === "text") {
          const text = stringValue(block.text);
          if (text) {
            this.upsertLog({
              id: `${eventId}-message-${index}`,
              kind: "message",
              title: "メッセージ",
              text,
            });
          }
        } else if (blockType === "tool_use") {
          const toolName = stringValue(block.name) || "ツール";
          this.upsertLog({
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
        const existing = this.logs.find((log) => log.id === id);
        this.upsertLog({
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
      this.upsertLog({
        id,
        kind: "tool",
        title: `ツール使用: ${stringValue(event.tool_name) || "ツール"}`,
        text: "",
        detail: stringValue(event.message) || "権限が拒否されました。",
        status: "failed",
      });
    }
  }

  private handleOpenCodeEvent(
    event: Record<string, unknown>,
    state: StructuredOutputState,
  ): void {
    const result = parseOpenCodeEvent(event, `opencode-${++state.lineNumber}`);
    if (result.log) this.upsertLog(result.log);
    if (result.finalOutput) state.finalOutput = result.finalOutput;
    if (result.errorMessage) state.errorMessage = result.errorMessage;
  }
}
