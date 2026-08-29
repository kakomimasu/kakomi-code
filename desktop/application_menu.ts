export type ApplicationMenuItem =
  | {
    item: {
      label: string;
      id?: string;
      accelerator?: string;
      enabled: boolean;
    };
  }
  | { submenu: { label: string; items: ApplicationMenuItem[] } }
  | "separator"
  | { role: { role: string } };

export function applicationMenu(): ApplicationMenuItem[] {
  return [
    {
      submenu: {
        label: "囲みコード",
        items: [{ role: { role: "quit" } }],
      },
    },
    {
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
    },
    {
      submenu: {
        label: "ウィンドウ",
        items: [
          { role: { role: "minimize" } },
          { role: { role: "close" } },
        ],
      },
    },
  ];
}
