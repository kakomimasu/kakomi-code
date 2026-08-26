import { assertEquals } from "@std/assert";
import { createTerminalTextSanitizer, stripTerminalSequences } from "../desktop/terminal_text.ts";

Deno.test("対戦ログから色やカーソル操作のエスケープシーケンスを除去する", () => {
  assertEquals(
    stripTerminalSequences("通常 \x1b[31m赤\x1b[0m \x1b[2K完了\n"),
    "通常 赤 完了\n",
  );
  assertEquals(
    stripTerminalSequences("\x1b]8;;https://example.com\x1b\\リンク\x1b]8;;\x1b\\"),
    "リンク",
  );
});

Deno.test("チャンクの途中で分割されたエスケープシーケンスも除去する", () => {
  const sanitizer = createTerminalTextSanitizer();
  assertEquals(sanitizer.write("開始 \x1b["), "開始 ");
  assertEquals(sanitizer.write("32m成功\x1b"), "成功");
  assertEquals(sanitizer.write("[0m\n"), "\n");
});
