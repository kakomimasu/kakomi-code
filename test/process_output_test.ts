import { assertEquals } from "@std/assert";
import {
  appendCapturedOutput,
  captureOutput,
  MAX_CAPTURED_OUTPUT_CHARACTERS,
} from "../desktop/process_output.ts";

function byteStream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      chunks.forEach((chunk) => controller.enqueue(encoder.encode(chunk)));
      controller.close();
    },
  });
}

Deno.test("プロセス出力から端末制御文字を除いて通知する", async () => {
  const messages: string[] = [];
  const output = await captureOutput(
    byteStream(["\x1b[31", "mエラー\x1b[0m"]),
    "stderr",
    (message) => messages.push(message),
  );

  assertEquals(output, "エラー");
  assertEquals(messages.join(""), "[stderr] エラー");
});

Deno.test("保持するプロセス出力を上限で切る", () => {
  const current = "a".repeat(MAX_CAPTURED_OUTPUT_CHARACTERS - 2);
  const output = appendCapturedOutput(current, "bcdef");

  assertEquals(output.length, MAX_CAPTURED_OUTPUT_CHARACTERS);
  assertEquals(output.endsWith("bc"), true);
});
