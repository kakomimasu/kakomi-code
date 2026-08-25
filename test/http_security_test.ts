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
});
