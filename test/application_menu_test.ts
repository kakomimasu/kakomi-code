import { assertEquals } from "@std/assert";
import { applicationMenu } from "../desktop/application_menu.ts";

Deno.test("アプリメニューはOS標準の終了操作を使う", () => {
  const menu = applicationMenu();
  assertEquals(menu[0], {
    submenu: {
      label: "囲みコード",
      items: [{ role: { role: "quit" } }],
    },
  });
});

Deno.test("編集メニューはOS標準の編集操作を使う", () => {
  const menu = applicationMenu();
  assertEquals(menu[1], {
    submenu: {
      label: "編集",
      items: [
        { role: { role: "undo" } },
        { role: { role: "redo" } },
        "separator",
        { role: { role: "cut" } },
        { role: { role: "copy" } },
        { role: { role: "paste" } },
        { role: { role: "selectAll" } },
      ],
    },
  });
});
