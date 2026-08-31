import { assertEquals, assertStringIncludes } from "@std/assert";
import { CodingAgentReference } from "../desktop/coding_agent_reference.ts";

Deno.test("クライアント参照ソースをまとめてキャッシュする", async () => {
  let fetchCount = 0;
  const reference = new CodingAgentReference((input) => {
    fetchCount++;
    return Promise.resolve(new Response(`source: ${String(input)}`));
  });
  const signal = new AbortController().signal;

  const first = await reference.load(signal);
  const second = await reference.load(signal);

  assertStringIncludes(first, "KakomimasuClient.ts");
  assertStringIncludes(first, "```ts");
  assertEquals(second, first);
  assertEquals(fetchCount, 6);
});

Deno.test("必須の参照ソースを取得できない場合は安全な案内へフォールバックする", async () => {
  const reference = new CodingAgentReference(() =>
    Promise.resolve(new Response("", { status: 503 }))
  );

  const context = await reference.load(new AbortController().signal);

  assertStringIncludes(context, "参照ソースは取得できませんでした");
  assertStringIncludes(context, "Web検索はせず");
});
