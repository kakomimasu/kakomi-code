import { assertEquals } from "@std/assert";
import { prefersDarkMode } from "../desktop/ui/hooks/use-color-scheme.ts";
import { isTrustedViewerUrl, loadViewerState, saveViewerState } from "../desktop/ui/viewer.ts";

Deno.test("OSがダーク表示ならアプリもダークモードで初期化する", () => {
  assertEquals(prefersDarkMode(() => ({ matches: true })), true);
  assertEquals(prefersDarkMode(() => ({ matches: false })), false);
});

Deno.test("対戦画面は信頼できるURLだけをチャット欄で開く", () => {
  assertEquals(isTrustedViewerUrl("https://kakomimasu.com/game?id=example-game"), true);
  assertEquals(isTrustedViewerUrl("https://kakomimasu.com/game"), false);
  assertEquals(isTrustedViewerUrl("https://example.com/game?id=example-game"), false);
  assertEquals(isTrustedViewerUrl("not-a-url"), false);
});

Deno.test("エージェントへ戻ると開いていた対戦画面を復元する", () => {
  const states = saveViewerState(
    {},
    "versions/agent-a",
    "https://kakomimasu.com/game?id=agent-a-game",
    true,
  );
  assertEquals(loadViewerState(states, "versions/agent-b"), { url: "", open: false });
  assertEquals(loadViewerState(states, "versions/agent-a"), {
    url: "https://kakomimasu.com/game?id=agent-a-game",
    open: true,
  });
});
