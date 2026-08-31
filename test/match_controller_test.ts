import { assertEquals, assertThrows } from "@std/assert";
import { join } from "@std/path";
import {
  MatchController,
  resolveMatchNetworkTarget,
  validateMatchSettings,
} from "../desktop/match_controller.ts";

Deno.test("対戦設定を検証して前後の空白を除く", () => {
  assertEquals(
    validateMatchSettings({
      agentName: "  初心者AI  ",
      aiName: "a2",
      board: "  A-1  ",
      versionDir: "v001-sample",
    }),
    {
      agentName: "初心者AI",
      aiName: "a2",
      board: "A-1",
      versionDir: "v001-sample",
    },
  );
});

Deno.test("対戦設定の改行や未知の練習相手を拒否する", () => {
  assertThrows(
    () =>
      validateMatchSettings({
        agentName: "AI\n名前",
        aiName: "a1",
        board: "A-1",
        versionDir: "v001-sample",
      }),
    Error,
    "AI名は1〜40文字",
  );
  assertThrows(
    () =>
      validateMatchSettings({
        agentName: "AI",
        aiName: "unknown",
        board: "A-1",
        versionDir: "v001-sample",
      }),
    Error,
    "練習相手を選択",
  );
});

Deno.test("対戦APIのHTTP通信先だけを許可する", () => {
  assertEquals(resolveMatchNetworkTarget(undefined), "api.kakomimasu.com");
  assertEquals(resolveMatchNetworkTarget("http://127.0.0.1:8080/path"), "127.0.0.1:8080");
  assertThrows(
    () => resolveMatchNetworkTarget("file:///tmp/socket"),
    Error,
    "KAKOMIMASU_HOSTにはHTTPまたはHTTPS",
  );
});

Deno.test("準備中の対戦を停止すると待機状態へ戻る", async () => {
  const projectDir = await Deno.makeTempDir();
  try {
    const versionDir = join(projectDir, "versions", "v001-test");
    await Deno.mkdir(versionDir, { recursive: true });
    await Deno.writeTextFile(join(versionDir, "main.ts"), "export {};\n");
    const controller = new MatchController(projectDir, join(projectDir, "deno.json"));

    const starting = controller.start({
      agentName: "テストAI",
      aiName: "a1",
      board: "A-1",
      versionDir,
    });
    assertEquals(controller.getState().running, true);
    assertEquals(controller.stop().stopped, true);
    const result = await starting;
    assertEquals("stopped" in result && result.stopped, true);
    assertEquals(controller.getState().running, false);
  } finally {
    await Deno.remove(projectDir, { recursive: true });
  }
});
