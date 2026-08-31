import { assertEquals, assertThrows } from "@std/assert";
import {
  parseCreateVersionRequest,
  parseRenameVersionRequest,
  parseSaveSourceRequest,
  parseVersionDirectory,
} from "../desktop/api_requests.ts";

Deno.test("バージョン作成APIの入力を検証して空白を除く", () => {
  assertEquals(
    parseCreateVersionRequest({
      agentName: "  中央優先  ",
      sourceVersion: "v001-source",
    }),
    { agentName: "中央優先", sourceVersion: "v001-source" },
  );
  assertEquals(parseCreateVersionRequest("  外周優先  "), {
    agentName: "外周優先",
  });
});

Deno.test("バージョン作成APIは不正な名前とコピー元を拒否する", () => {
  assertThrows(() => parseCreateVersionRequest({ agentName: "  " }), Error, "AI名を入力");
  assertThrows(
    () => parseCreateVersionRequest({ agentName: "AI", sourceVersion: 123 }),
    Error,
    "コピー元のバージョンが不正",
  );
});

Deno.test("名前変更APIの入力を検証する", () => {
  assertEquals(
    parseRenameVersionRequest({
      versionDir: "v001-source",
      agentName: "  新しい名前  ",
    }),
    { versionDir: "v001-source", agentName: "新しい名前" },
  );
  assertThrows(
    () =>
      parseRenameVersionRequest({
        versionDir: "v001-source",
        agentName: "不正\nな名前",
      }),
    Error,
    "AI名は1〜40文字",
  );
});

Deno.test("ソース保存APIは有効な文字列だけを受け取る", () => {
  const request = parseSaveSourceRequest("v001-source", "  export {};\n");
  assertEquals(request, { versionDir: "v001-source", source: "  export {};\n" });
  assertThrows(
    () => parseSaveSourceRequest("v001-source", "   \n"),
    Error,
    "ソースは1〜1,000,000文字",
  );
  assertThrows(() => parseVersionDirectory(""), Error, "バージョンを選択");
});
