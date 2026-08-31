import { assertEquals, assertStringIncludes, assertThrows } from "@std/assert";
import {
  buildImprovementPrompt,
  validateImproveRequest,
} from "../desktop/coding_agent_controller.ts";

Deno.test("コーディングAIの改善依頼を検証して空白を除く", () => {
  assertEquals(
    validateImproveRequest({
      idea: "  相手の近くを囲む  ",
      versionDir: "v001-sample",
      agent: "codex",
      model: "  gpt-5.6  ",
    }),
    {
      idea: "相手の近くを囲む",
      versionDir: "v001-sample",
      agent: "codex",
      model: "gpt-5.6",
    },
  );
  assertEquals(
    validateImproveRequest({
      idea: "改善する",
      versionDir: "v001-sample",
      agent: "claude",
    }).model,
    "",
  );
});

Deno.test("不正なコーディングAIとモデルIDを拒否する", () => {
  assertThrows(
    () =>
      validateImproveRequest({
        idea: `改善${" ".repeat(100_000)}`,
        versionDir: "v001-sample",
        agent: "codex",
        model: "",
      }),
    Error,
    "作戦のアイデアは1〜100,000文字",
  );
  assertThrows(
    () =>
      validateImproveRequest({
        idea: "改善する",
        versionDir: "v001-sample",
        agent: "unknown",
        model: "",
      }),
    Error,
    "コーディングAIを選択",
  );
  assertThrows(
    () =>
      validateImproveRequest({
        idea: "改善する",
        versionDir: "v001-sample",
        agent: "codex",
        model: "invalid model",
      }),
    Error,
    "モデルIDは英数字",
  );
});

Deno.test("改善プロンプトは編集範囲と外部アクセス禁止を明記する", () => {
  const prompt = buildImprovementPrompt({
    idea: "中央を優先する",
    versionDir: "v001-sample",
    agent: "opencode",
    model: "",
  }, "クライアント参照ソース");

  assertStringIncludes(prompt, "編集してよいのは main.ts だけ");
  assertStringIncludes(prompt, "Web検索、ブラウザ、外部サイトや外部APIへのアクセスは使用禁止");
  assertStringIncludes(prompt, "コマンドは実行しないでください");
  assertStringIncludes(prompt, "クライアント参照ソース");
  assertStringIncludes(prompt, "中央を優先する");
});
