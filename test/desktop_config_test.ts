import { assertEquals } from "@std/assert";

Deno.test("デスクトップアプリはChromiumを内蔵する", async () => {
  const config = JSON.parse(await Deno.readTextFile("deno.json"));
  assertEquals(config.desktop?.backend, "cef");
});
