import { MAX_LOG_TEXT_CHARACTERS } from "./process_output.ts";

export type CodingAgentLog = {
  id: string;
  kind: "message" | "tool" | "status";
  title: string;
  text: string;
  detail?: string;
  status?: string;
};

export function recordValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

export function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function stringifyLogValue(
  value: unknown,
  limit = MAX_LOG_TEXT_CHARACTERS,
): string {
  const text = typeof value === "string" ? value : JSON.stringify(value, null, 2) ?? String(value);
  return text.length > limit ? `${text.slice(0, limit)}\n…（長すぎるため省略）` : text;
}

export function codexItemLog(
  item: Record<string, unknown>,
  fallbackId: string,
): CodingAgentLog | null {
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
      const todo = recordValue(value);
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
        const change = recordValue(value);
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

export function contentBlocks(event: Record<string, unknown>): Record<string, unknown>[] {
  const message = recordValue(event.message);
  const content = message?.content ?? event.content;
  if (typeof content === "string") return [{ type: "text", text: content }];
  return Array.isArray(content)
    ? content.map(recordValue).filter((value): value is Record<string, unknown> => value !== null)
    : [];
}
