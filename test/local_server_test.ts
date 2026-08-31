import { assertEquals } from "@std/assert";
import { type ApiHandler, createLocalRequestHandler } from "../desktop/local_server.ts";

function apiRequest(token?: string): Request {
  const headers = new Headers({
    "content-type": "application/json",
    origin: "http://127.0.0.1:8000",
  });
  if (token) headers.set("x-kakomi-api-token", token);
  return new Request("http://127.0.0.1:8000/api/bindings/sum", {
    method: "POST",
    headers,
    body: JSON.stringify({ args: [2, 3] }),
  });
}

Deno.test("ローカルAPIは検証済みリクエストだけをハンドラーへ渡す", async () => {
  let callCount = 0;
  const apiHandlers = new Map<string, ApiHandler>([
    ["sum", (left, right) => {
      callCount++;
      return Number(left) + Number(right);
    }],
  ]);
  const handle = createLocalRequestHandler({
    apiToken: "secret",
    apiHandlers,
    staticRoot: new URL("file:///not-used/"),
  });

  const forbidden = await handle(apiRequest());
  assertEquals(forbidden.status, 403);
  assertEquals(callCount, 0);

  const accepted = await handle(apiRequest("secret"));
  assertEquals(accepted.status, 200);
  assertEquals(await accepted.json(), { result: 5 });
  assertEquals(callCount, 1);
});
