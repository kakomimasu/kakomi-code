import { assertEquals } from "@std/assert";

type ViewerApp = {
  selected: string;
  tab: string;
  darkMode: boolean;
  viewerUrl: string;
  viewerOpen: boolean;
  viewerLoading: boolean;
  viewerStates: Record<string, { url: string; open: boolean }>;
  matchStatus: string;
  scrollChat: () => void;
  openViewer: () => void;
  closeViewer: () => void;
  selectVersion: (path: string) => Promise<void>;
};

Deno.test("OSがダーク表示ならアプリもダークモードで初期化する", async () => {
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  const originalLocalStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const originalMatchMedia = Object.getOwnPropertyDescriptor(globalThis, "matchMedia");
  const originalApp = Object.getOwnPropertyDescriptor(globalThis, "kakomiApp");
  try {
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: { querySelector: () => null },
    });
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: { getItem: () => null, setItem: () => {} },
    });
    Object.defineProperty(globalThis, "matchMedia", {
      configurable: true,
      value: () => ({ matches: true }),
    });
    await import(`../desktop/ui.js?dark-mode-test=${crypto.randomUUID()}`);

    const app = (globalThis as typeof globalThis & { kakomiApp: () => ViewerApp }).kakomiApp();
    assertEquals(app.darkMode, true);
  } finally {
    restoreGlobal("document", originalDocument);
    restoreGlobal("localStorage", originalLocalStorage);
    restoreGlobal("matchMedia", originalMatchMedia);
    restoreGlobal("kakomiApp", originalApp);
  }
});

Deno.test("対戦画面は信頼できるURLだけをチャット欄で開く", async () => {
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  const originalLocalStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const originalApp = Object.getOwnPropertyDescriptor(globalThis, "kakomiApp");
  try {
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: { querySelector: () => null },
    });
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: { getItem: () => null, setItem: () => {} },
    });
    await import(`../desktop/ui.js?viewer-test=${crypto.randomUUID()}`);

    const app = (globalThis as typeof globalThis & { kakomiApp: () => ViewerApp }).kakomiApp();
    app.scrollChat = () => {};
    app.viewerUrl = "https://kakomimasu.com/game?id=example-game";
    app.openViewer();
    assertEquals(app.viewerOpen, true);
    assertEquals(app.viewerLoading, true);

    app.closeViewer();
    assertEquals(app.viewerOpen, false);
    assertEquals(app.viewerLoading, false);

    app.viewerUrl = "https://example.com/game?id=example-game";
    app.openViewer();
    assertEquals(app.viewerOpen, false);
    assertEquals(app.matchStatus, "エラー: 対戦画面のURLを確認できませんでした。");
  } finally {
    restoreGlobal("document", originalDocument);
    restoreGlobal("localStorage", originalLocalStorage);
    restoreGlobal("kakomiApp", originalApp);
  }
});

Deno.test("エージェントへ戻ると開いていた対戦画面を復元する", async () => {
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  const originalLocalStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const originalApp = Object.getOwnPropertyDescriptor(globalThis, "kakomiApp");
  try {
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: { querySelector: () => null },
    });
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: { getItem: () => null, setItem: () => {} },
    });
    await import(`../desktop/ui.js?viewer-switch-test=${crypto.randomUUID()}`);

    const app = (globalThis as typeof globalThis & { kakomiApp: () => ViewerApp }).kakomiApp();
    app.scrollChat = () => {};
    app.selected = "versions/agent-a";
    app.tab = "match";
    app.viewerUrl = "https://kakomimasu.com/game?id=agent-a-game";
    app.openViewer();

    await app.selectVersion("versions/agent-b");
    assertEquals(app.viewerOpen, false);
    assertEquals(app.viewerUrl, "");

    await app.selectVersion("versions/agent-a");
    assertEquals(app.viewerOpen, true);
    assertEquals(app.viewerLoading, true);
    assertEquals(app.viewerUrl, "https://kakomimasu.com/game?id=agent-a-game");
  } finally {
    restoreGlobal("document", originalDocument);
    restoreGlobal("localStorage", originalLocalStorage);
    restoreGlobal("kakomiApp", originalApp);
  }
});

function restoreGlobal(name: string, descriptor: PropertyDescriptor | undefined) {
  if (descriptor) Object.defineProperty(globalThis, name, descriptor);
  else delete (globalThis as Record<string, unknown>)[name];
}
