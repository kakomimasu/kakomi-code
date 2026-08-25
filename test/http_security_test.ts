import { assertEquals } from "@std/assert";
import { hasValidApiToken, isTrustedLoopbackRequest } from "../desktop/http_security.ts";

Deno.test("ローカルAPIは127.0.0.1の同一オリジンだけを許可する", () => {
  assertEquals(
    isTrustedLoopbackRequest(
      new URL("http://127.0.0.1:8000/api/bindings/getDashboard"),
      "http://127.0.0.1:8000",
    ),
    true,
  );
  assertEquals(
    isTrustedLoopbackRequest(
      new URL("http://localhost:8000/api/bindings/getDashboard"),
      "http://localhost:8000",
    ),
    true,
  );
  assertEquals(
    isTrustedLoopbackRequest(
      new URL("http://attacker.example:8000/api/bindings/getDashboard"),
      "http://attacker.example:8000",
    ),
    false,
  );
  assertEquals(
    isTrustedLoopbackRequest(
      new URL("http://127.0.0.1:8000/api/bindings/getDashboard"),
      "http://attacker.example:8000",
    ),
    false,
  );
});

Deno.test("ローカルAPIはlocalhostとIPv6ループバックを許可する", () => {
  for (
    const url of [
      "http://localhost:8000/api/bindings/getDashboard",
      "http://[::1]:8000/api/bindings/getDashboard",
    ]
  ) {
    assertEquals(isTrustedLoopbackRequest(new URL(url), new URL(url).origin), true);
    assertEquals(isTrustedLoopbackRequest(new URL(url), null), true);
  }
});

Deno.test("ローカルAPIは偽装ホスト・HTTPS・異なるポートを拒否する", () => {
  const cases: Array<[string, string | null]> = [
    ["http://127.0.0.1.attacker.example:8000/api", null],
    ["http://0.0.0.0:8000/api", null],
    ["https://127.0.0.1:8000/api", "https://127.0.0.1:8000"],
    ["http://127.0.0.1:8000/api", "http://127.0.0.1:9000"],
    ["http://127.0.0.1:8000/api", "not a valid origin"],
  ];

  for (const [url, origin] of cases) {
    assertEquals(isTrustedLoopbackRequest(new URL(url), origin), false);
  }
});

Deno.test("ローカルAPIは起動ごとのトークンを要求する", () => {
  assertEquals(
    hasValidApiToken(new Headers({ "x-kakomi-api-token": "expected" }), "expected"),
    true,
  );
  assertEquals(hasValidApiToken(new Headers(), "expected"), false);
  assertEquals(
    hasValidApiToken(new Headers({ "x-kakomi-api-token": "wrong" }), "expected"),
    false,
  );
  assertEquals(
    hasValidApiToken(new Headers({ "X-Kakomimasu-Api-Token": " expected " }), "expected"),
    false,
  );
});
