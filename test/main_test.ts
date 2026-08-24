import { assertEquals } from "@std/assert";
import { decideActions } from "../template/main.ts";

Deno.test("初期テンプレートは行動を返さない", () => {
  assertEquals(decideActions(), []);
});
