import { assertEquals, assertThrows } from "@std/assert";
import { validateWindowGeometry } from "../desktop/window_geometry.ts";

Deno.test("利用可能な画面領域をウィンドウサイズへ変換する", () => {
  assertEquals(
    validateWindowGeometry({ width: 1512.8, height: 944.2, x: -1512, y: 25 }),
    { width: 1512, height: 944, x: -1512, y: 25 },
  );
});

Deno.test("不正な画面領域ではウィンドウを変更しない", () => {
  for (
    const value of [
      null,
      { width: 0, height: 900, x: 0, y: 0 },
      { width: 1440, height: Number.NaN, x: 0, y: 0 },
      { width: 1440, height: 900, x: "0", y: 0 },
      { width: 100_000, height: 900, x: 0, y: 0 },
    ]
  ) {
    assertThrows(() => validateWindowGeometry(value), Error, "画面サイズを確認できませんでした。");
  }
});
