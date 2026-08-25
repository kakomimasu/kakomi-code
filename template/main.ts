/**
 * 囲みコードの最小テンプレートです。
 * `actions` に行動を追加して、少しずつ作戦を作っていきます。
 */
import { type ActionPost, KakomimasuClient } from "@kakomimasu/client-deno";

const aiName = Deno.env.get("AI_NAME");
const boardName = Deno.env.get("AI_BOARD");
const matchMode = Deno.env.get("MATCH_MODE") || "free";
const gameId = Deno.env.get("GAME_ID");
const host = Deno.env.get("KAKOMIMASU_HOST");
const bearerToken = Deno.env.get("BEARER_TOKEN");

if (matchMode === "ai" && (!aiName || !boardName)) {
  throw new Error("MATCH_MODE=ai では AI_NAME と AI_BOARD が必要です。");
}
if (matchMode === "game" && !gameId) {
  throw new Error("MATCH_MODE=game では GAME_ID が必要です。");
}

const player = bearerToken
  ? { bearerToken }
  : { name: Deno.env.get("AGENT_NAME") || "エルメマス", spec: "囲みコード" };
const match = matchMode === "ai"
  ? { aiName: aiName as never, boardName: boardName as never }
  : matchMode === "game"
  ? { gameId: gameId as string }
  : {};

export const client = new KakomimasuClient({
  ...player,
  ...match,
  ...(host ? { host } : {}),
});

// Desktopの練習対戦では、対戦画面へのリンクを表示する。
if (matchMode === "ai") {
  const api = client.apiClient as {
    joinAiMatch: (...args: unknown[]) => Promise<{ gameId?: string }>;
  };
  const joinAiMatch = api.joinAiMatch.bind(client.apiClient);
  api.joinAiMatch = async (...args) => {
    const result = await joinAiMatch(...args);
    if (result.gameId) console.log(`VIEWER_URL=https://kakomimasu.com/game?id=${result.gameId}`);
    return result;
  };
}

export function decideActions(): ActionPost[] {
  const actions: ActionPost[] = [];
  // 例: actions.push({ agentId: 0, type: "PUT", x: 0, y: 0 });
  return actions;
}

client.oninit = () => {
  // ゲーム開始時にしたい処理を書く。
};

client.onturn = () => decideActions();

if (import.meta.main) await client.match();
