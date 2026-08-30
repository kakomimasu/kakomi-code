import { assertEquals } from "@std/assert";
import { taskkillArgs } from "../desktop/process_tree.ts";

Deno.test("Windowsでは子孫を含むtaskkill引数を組み立てる", () => {
  assertEquals(taskkillArgs(1234, false), ["/PID", "1234", "/T"]);
  assertEquals(taskkillArgs(1234, true), ["/PID", "1234", "/T", "/F"]);
});
