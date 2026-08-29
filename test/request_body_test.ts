import { assertEquals, assertRejects } from "@std/assert";
import { readJsonBody, RequestBodyTooLargeError } from "../desktop/request_body.ts";

Deno.test("API本文は上限内のJSONだけを読み込む", async () => {
  const request = new Request("http://127.0.0.1/", {
    method: "POST",
    body: JSON.stringify({ args: ["作戦"] }),
  });
  assertEquals(await readJsonBody(request, 1_000), { args: ["作戦"] });
});

Deno.test("API本文はContent-Lengthがなくても読み込み上限を超えたら拒否する", async () => {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('{"value":"'));
      controller.enqueue(new TextEncoder().encode("長すぎる本文"));
      controller.enqueue(new TextEncoder().encode('"}'));
      controller.close();
    },
  });
  const request = new Request("http://127.0.0.1/", { method: "POST", body: stream });
  await assertRejects(
    () => readJsonBody(request, 10),
    RequestBodyTooLargeError,
    "リクエストが大きすぎます。",
  );
});
