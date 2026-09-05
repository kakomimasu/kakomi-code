import { assertEquals, assertExists, assertStringIncludes } from "@std/assert";
import { Window } from "happy-dom";

const browserWindow = new Window({ url: "http://127.0.0.1/" });
const windowValues = browserWindow as unknown as Record<string, unknown>;
const boundFunctions = new Set([
  "cancelAnimationFrame",
  "getComputedStyle",
  "matchMedia",
  "requestAnimationFrame",
]);

Object.defineProperties(globalThis, {
  window: { configurable: true, value: browserWindow },
  document: { configurable: true, value: browserWindow.document },
  navigator: { configurable: true, value: browserWindow.navigator },
  IS_REACT_ACT_ENVIRONMENT: { configurable: true, value: false },
});

for (
  const name of [
    "CSS",
    "CSSStyleSheet",
    "Comment",
    "CustomEvent",
    "Document",
    "DocumentFragment",
    "DOMRect",
    "DOMRectReadOnly",
    "Element",
    "Event",
    "FocusEvent",
    "HTMLButtonElement",
    "HTMLDivElement",
    "HTMLElement",
    "HTMLFormElement",
    "HTMLInputElement",
    "HTMLLabelElement",
    "HTMLTextAreaElement",
    "KeyboardEvent",
    "localStorage",
    "MouseEvent",
    "MutationObserver",
    "Node",
    "NodeFilter",
    "PointerEvent",
    "ResizeObserver",
    "ShadowRoot",
    "SVGElement",
    "Text",
    "cancelAnimationFrame",
    "customElements",
    "getComputedStyle",
    "matchMedia",
    "requestAnimationFrame",
  ]
) {
  const value = windowValues[name];
  Object.defineProperty(globalThis, name, {
    configurable: true,
    value: boundFunctions.has(name) && typeof value === "function"
      ? value.bind(browserWindow)
      : value,
  });
}

const testDocument = browserWindow.document as unknown as Document;

const { useRef, useState } = await import("react");
const { flushSync } = await import("react-dom");
const { createRoot } = await import("react-dom/client");
const { AppStoreProvider, createAppStore, useAppStore } = await import(
  "../desktop/ui/hooks/use-app-store.tsx"
);
const { selectKakomiViewState } = await import(
  "../desktop/ui/hooks/use-kakomi-app.ts"
);
const { useChat } = await import("../desktop/ui/hooks/use-chat.ts");
const { useDashboard } = await import("../desktop/ui/hooks/use-dashboard.ts");
const { useSourceEditor } = await import("../desktop/ui/hooks/use-source-editor.ts");
const { AppDialog, useDialogController } = await import("../desktop/ui/dialogs.tsx");
const { AppErrorBoundary } = await import("../desktop/ui/error-boundary.tsx");
const { ModelPicker } = await import("../desktop/ui/model-picker.tsx");
const { ResizeHandle, StatusText } = await import(
  "../desktop/ui/primitives.tsx"
);

function createTestRoot() {
  browserWindow.document.body.innerHTML = "";
  const happyHost = browserWindow.document.createElement("div");
  browserWindow.document.body.append(happyHost);
  const host = happyHost as unknown as HTMLDivElement;
  return { host, root: createRoot(host) };
}

type ChatStore = ReturnType<typeof createAppStore>;
type ChatSource = {
  loadSource(versionPath?: string): Promise<void>;
  saveIfDirty(): Promise<boolean>;
};

const testDialogs = {
  requestText() {
    return Promise.resolve(null);
  },
  requestConfirmation() {
    return Promise.resolve(false);
  },
};

function StoreSelectorHarness() {
  const view = useAppStore(selectKakomiViewState);
  return <output data-store-selected>{`${view.selected}:${view.messages.length}`}</output>;
}

function ChatHookHarness({
  store,
  source,
  improvements,
}: {
  store: ChatStore;
  source: ChatSource;
  improvements: Promise<void>[];
}) {
  const feedRef = useRef<HTMLDivElement>(null);
  const chat = useChat(store, feedRef, source, testDialogs);
  return (
    <>
      <textarea data-chat-keyboard onKeyDown={chat.sendOnEnter} />
      <button
        type="button"
        data-chat-improve
        onClick={() => improvements.push(chat.improve())}
      >
        改善
      </button>
    </>
  );
}

type SourceEditorActions = ReturnType<typeof useSourceEditor>;

function SourceEditorHarness({
  store,
  receiveActions,
}: {
  store: ChatStore;
  receiveActions(actions: SourceEditorActions): void;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const actions = useSourceEditor(store, editorRef, false);
  receiveActions(actions);
  return <div ref={editorRef} />;
}

function fakeMonacoEditor() {
  let value = "";
  let onChange = () => {};
  const editor = {
    addCommand() {},
    dispose() {},
    getValue: () => value,
    layout() {},
    onDidChangeModelContent(handler: () => void) {
      onChange = handler;
    },
    setValue(nextValue: string) {
      value = nextValue;
      onChange();
    },
  };
  const amdRequire = Object.assign(
    (_modules: string[], ready: () => void) => ready(),
    { config() {} },
  );
  const monaco = {
    editor: {
      create: () => editor,
      setTheme() {},
    },
    languages: {
      typescript: {
        ModuleKind: { ESNext: 1 },
        ModuleResolutionKind: { NodeJs: 1 },
        ScriptTarget: { ESNext: 1 },
        typescriptDefaults: {
          addExtraLib: () => ({ dispose() {} }),
          setCompilerOptions() {},
          setDiagnosticsOptions() {},
        },
      },
    },
    KeyCode: { KeyS: 1 },
    KeyMod: { CtrlCmd: 2 },
  };
  return {
    amdRequire,
    monaco,
    edit(nextValue: string) {
      value = nextValue;
      onChange();
    },
    getValue: () => value,
  };
}

let confirmationResult: boolean | null = null;

function DialogHarness() {
  const controller = useDialogController();
  return (
    <>
      <button
        type="button"
        data-trigger="text"
        onClick={() => {
          void controller.requestText({
            title: "名前を変更",
            description: "新しい名前を入力してください。",
            initialValue: "テストAI",
            confirmLabel: "変更",
          });
        }}
      >
        名前を変更
      </button>
      <button
        type="button"
        data-trigger="confirm"
        onClick={() => {
          void controller.requestConfirmation({
            title: "削除しますか？",
            description: "元に戻せません。",
            confirmLabel: "削除",
            danger: true,
          }).then((confirmed) => {
            confirmationResult = confirmed;
          });
        }}
      >
        削除を確認
      </button>
      <AppDialog controller={controller} />
    </>
  );
}

Deno.test("Zustand Providerは空のチャットでもselectorを安定して購読する", () => {
  const { host, root } = createTestRoot();
  browserWindow.localStorage.clear();
  const store = createAppStore();
  try {
    flushSync(() =>
      root.render(
        <AppStoreProvider store={store}>
          <StoreSelectorHarness />
        </AppStoreProvider>,
      )
    );
    const selected = host.querySelector<HTMLOutputElement>("[data-store-selected]");
    assertExists(selected);
    assertEquals(selected.textContent, ":0");

    flushSync(() => store.getState().updateWorkspace({ selected: "versions/test-agent" }));
    assertEquals(selected.textContent, "versions/test-agent:0");
  } finally {
    flushSync(() => root.unmount());
  }
});

Deno.test("StatusTextは状態の変化を読み上げ対象にする", () => {
  const { host, root } = createTestRoot();
  try {
    flushSync(() => root.render(<StatusText>保存しました。</StatusText>));
    const status = host.querySelector('[role="status"]');
    assertExists(status);
    assertEquals(status.getAttribute("aria-live"), "polite");
    assertEquals(status.getAttribute("aria-atomic"), "true");
    assertEquals(status.getAttribute("data-tone"), "success");
    assertEquals(status.textContent, "保存しました。");

    flushSync(() => root.render(<StatusText>保存しています…</StatusText>));
    assertEquals(host.querySelector('[role="status"]')?.getAttribute("data-tone"), "progress");

    flushSync(() => root.render(<StatusText>エラー: 保存できませんでした。</StatusText>));
    const alert = host.querySelector('[role="alert"]');
    assertExists(alert);
    assertEquals(alert.getAttribute("aria-live"), "assertive");
    assertEquals(alert.getAttribute("data-tone"), "error");
  } finally {
    flushSync(() => root.unmount());
  }
});

function BrokenScreen(): never {
  throw new Error("描画テストのエラー");
}

Deno.test("Error Boundaryは復旧画面と再読み込み操作を表示する", () => {
  const { host, root } = createTestRoot();
  const originalConsoleError = console.error;
  let reloadRequested = false;
  try {
    console.error = () => {};
    flushSync(() =>
      root.render(
        <AppErrorBoundary onReload={() => reloadRequested = true}>
          <BrokenScreen />
        </AppErrorBoundary>,
      )
    );
    const alert = host.querySelector('[role="alert"]');
    const reload = host.querySelector<HTMLButtonElement>("button");
    assertExists(alert);
    assertExists(reload);
    assertStringIncludes(alert.textContent || "", "画面を表示できませんでした");
    assertStringIncludes(alert.textContent || "", "描画テストのエラー");
    flushSync(() => reload.click());
    assertEquals(reloadRequested, true);
  } finally {
    console.error = originalConsoleError;
    flushSync(() => root.unmount());
  }
});

function ModelPickerHarness({
  agent,
}: {
  agent: "codex" | "claude" | "opencode";
}) {
  const [model, setModel] = useState("");
  return (
    <ModelPicker
      app={{
        agent,
        busy: false,
        model,
        modelOptions: [
          { value: "openai/gpt-5", label: "openai/gpt-5" },
          { value: "anthropic/claude", label: "anthropic/claude" },
        ],
        setModel,
        saveModel: () => {},
      }}
    />
  );
}

Deno.test("各コーディングAIのモデル一覧はクリック選択できる", () => {
  const { host, root } = createTestRoot();
  try {
    flushSync(() =>
      root.render(
        <>
          <ModelPickerHarness agent="codex" />
          <ModelPickerHarness agent="claude" />
          <ModelPickerHarness agent="opencode" />
        </>,
      )
    );
    for (const label of ["Codex", "Claude Code", "OpenCode"]) {
      const select = host.querySelector<HTMLSelectElement>(
        `select[aria-label="${label}のモデル"]`,
      );
      assertExists(select);
      assertEquals(select.value, "");
      flushSync(() => {
        select.value = "anthropic/claude";
        select.dispatchEvent(new Event("change", { bubbles: true }));
      });
      assertEquals(select.value, "anthropic/claude");
    }
  } finally {
    flushSync(() => root.unmount());
  }
});

Deno.test("作戦入力はEnter以外のキー操作を妨げない", () => {
  const { host, root } = createTestRoot();
  browserWindow.localStorage.clear();
  const store = createAppStore();
  const improvements: Promise<void>[] = [];
  try {
    flushSync(() =>
      root.render(
        <ChatHookHarness
          store={store}
          source={{
            loadSource() {
              return Promise.resolve();
            },
            saveIfDirty() {
              return Promise.resolve(true);
            },
          }}
          improvements={improvements}
        />,
      )
    );
    const textarea = host.querySelector<HTMLTextAreaElement>("[data-chat-keyboard]");
    assertExists(textarea);

    const letter = new KeyboardEvent("keydown", {
      key: "a",
      bubbles: true,
      cancelable: true,
    });
    flushSync(() => textarea.dispatchEvent(letter));
    assertEquals(letter.defaultPrevented, false);

    const enter = new KeyboardEvent("keydown", {
      key: "Enter",
      bubbles: true,
      cancelable: true,
    });
    flushSync(() => textarea.dispatchEvent(enter));
    assertEquals(enter.defaultPrevented, true);
  } finally {
    flushSync(() => root.unmount());
  }
});

Deno.test("改善ボタンを続けて押してもコーディングAIを二重起動しない", async () => {
  const { host, root } = createTestRoot();
  browserWindow.localStorage.clear();
  const store = createAppStore();
  const version = { path: "versions/test-agent", name: "v001-test-agent" };
  store.setState({
    dashboard: { projectDir: "/project", versions: [version] },
    selected: version.path,
    idea: "高得点を優先する",
  });
  const improvements: Promise<void>[] = [];
  let saveIfDirtyCount = 0;
  let improveWithAgentCount = 0;
  let loadSourceCount = 0;
  const originalBindings = Object.getOwnPropertyDescriptor(globalThis, "bindings");
  Object.defineProperty(globalThis, "bindings", {
    configurable: true,
    value: {
      saveChatHistory() {
        return Promise.resolve({ message: "保存しました。" });
      },
      improveWithAgent() {
        improveWithAgentCount++;
        return Promise.resolve({ output: "改善しました。" });
      },
    },
  });
  try {
    flushSync(() =>
      root.render(
        <ChatHookHarness
          store={store}
          source={{
            loadSource() {
              loadSourceCount++;
              return Promise.resolve();
            },
            saveIfDirty() {
              saveIfDirtyCount++;
              return Promise.resolve(true);
            },
          }}
          improvements={improvements}
        />,
      )
    );
    const improve = host.querySelector<HTMLButtonElement>("[data-chat-improve]");
    assertExists(improve);
    flushSync(() => {
      improve.click();
      improve.click();
    });
    await Promise.all(improvements);

    assertEquals(saveIfDirtyCount, 1);
    assertEquals(improveWithAgentCount, 1);
    assertEquals(loadSourceCount, 1);
    assertEquals(store.getState().messagesByVersion[version.path], [
      { role: "user", text: "高得点を優先する" },
      { role: "assistant", text: "改善しました。" },
    ]);
    assertEquals(store.getState().busy, false);
    assertEquals(store.getState().codingAgentRunning, false);
  } finally {
    if (originalBindings) {
      Object.defineProperty(globalThis, "bindings", originalBindings);
    } else {
      delete (globalThis as Record<string, unknown>).bindings;
    }
    flushSync(() => root.unmount());
  }
});

Deno.test("改善の成功・停止・失敗を履歴へ反映し、保存失敗後も操作できる", async (test) => {
  const cases = [
    {
      outcome: "success",
      text: "改善しました。",
      status: "改善が完了しました。",
      unsavedStatus: "改善は完了しましたが、履歴を保存できませんでした。",
    },
    {
      outcome: "cancelled",
      text: "ここまで変更しました。",
      status: "改善を停止しました。",
      unsavedStatus: "改善を停止しましたが、履歴を保存できませんでした。",
    },
    {
      outcome: "error",
      text: "エラー: 接続できませんでした",
      status: "エラー: 接続できませんでした",
      unsavedStatus: "エラー: 接続できませんでした（チャット履歴も保存できませんでした）",
    },
  ];
  for (const scenario of cases) {
    for (const saved of [true, false]) {
      await test.step(`${scenario.outcome} / 保存${saved ? "成功" : "失敗"}`, async () => {
        const { host, root } = createTestRoot();
        browserWindow.localStorage.clear();
        const store = createAppStore();
        const version = { path: "versions/test-agent", name: "v001-test-agent" };
        const other = { path: "versions/other", name: "v002-other" };
        const previous = [{ role: "assistant" as const, text: "前回の改善" }];
        store.setState({
          dashboard: { projectDir: "/project", versions: [version, other] },
          selected: version.path,
          idea: "高得点を優先する",
          messagesByVersion: { [version.path]: previous, [other.path]: previous },
        });
        const improvements: Promise<void>[] = [];
        const loadedVersions: (string | undefined)[] = [];
        const payloads: unknown[] = [];
        const originalBindings = Object.getOwnPropertyDescriptor(globalThis, "bindings");
        Object.defineProperty(globalThis, "bindings", {
          configurable: true,
          value: {
            saveChatHistory(payload: unknown) {
              payloads.push(payload);
              if (!saved) return Promise.reject(new Error("保存できませんでした"));
              return Promise.resolve({ message: "保存しました。" });
            },
            improveWithAgent() {
              if (scenario.outcome === "error") {
                return Promise.reject(new Error("接続できませんでした"));
              }
              return Promise.resolve({
                output: scenario.text,
                cancelled: scenario.outcome === "cancelled",
              });
            },
          },
        });
        try {
          flushSync(() =>
            root.render(
              <ChatHookHarness
                store={store}
                source={{
                  loadSource(versionPath) {
                    loadedVersions.push(versionPath);
                    return Promise.resolve();
                  },
                  saveIfDirty: () => Promise.resolve(true),
                }}
                improvements={improvements}
              />,
            )
          );
          const improve = host.querySelector<HTMLButtonElement>("[data-chat-improve]");
          assertExists(improve);
          flushSync(() => improve.click());
          await Promise.all(improvements);

          const expectedMessages = [
            ...previous,
            { role: "user", text: "高得点を優先する" },
            { role: "assistant", text: scenario.text },
          ];
          const state = store.getState();
          assertEquals(state.messagesByVersion[version.path], expectedMessages);
          assertEquals(state.messagesByVersion[other.path], previous);
          assertEquals(state.codingAgentResult, { versionDir: version.path, text: scenario.text });
          assertEquals(state.status, saved ? scenario.status : scenario.unsavedStatus);
          assertEquals(state.busy, false);
          assertEquals(state.codingAgentRunning, false);
          assertEquals(loadedVersions, [version.path]);
          assertEquals(payloads.length, 2);
          assertEquals(payloads[1], {
            [version.name]: expectedMessages,
            [other.name]: previous,
          });
        } finally {
          if (originalBindings) Object.defineProperty(globalThis, "bindings", originalBindings);
          else delete (globalThis as Record<string, unknown>).bindings;
          flushSync(() => root.unmount());
        }
      });
    }
  }
});

Deno.test("ソースタブへ戻っても未保存の編集内容を再読み込みで上書きしない", async () => {
  browserWindow.localStorage.clear();
  const store = createAppStore();
  store.setState({
    selected: "versions/test-agent",
    tab: "source",
    source: "const edited = true;",
    savedSource: "const edited = false;",
    sourceDirty: true,
  });
  let loadCount = 0;
  const dashboard = useDashboard(
    store,
    {
      loadSource() {
        loadCount++;
        return Promise.resolve();
      },
      saveIfDirty() {
        return Promise.resolve(true);
      },
      clear() {},
      layout() {},
    },
    {
      persistHistory() {
        return Promise.resolve(true);
      },
      scroll() {},
    },
    testDialogs,
  );

  await dashboard.selectTab("source");
  await dashboard.selectTab("match");
  await dashboard.selectTab("source");
  await Promise.resolve();

  assertEquals(loadCount, 0);
  assertEquals(store.getState().source, "const edited = true;");
  assertEquals(store.getState().sourceDirty, true);

  store.setState({ tab: "match", source: "", savedSource: "", sourceDirty: false });
  await dashboard.selectTab("source");
  assertEquals(loadCount, 1);
});

Deno.test("ソース取得中に入力した編集を遅れて届いた応答で上書きしない", async () => {
  const { root } = createTestRoot();
  browserWindow.localStorage.clear();
  const store = createAppStore();
  store.setState({
    selected: "versions/test-agent",
    source: "const saved = true;",
    savedSource: "const saved = true;",
  });
  const fakeEditor = fakeMonacoEditor();
  let actions: SourceEditorActions | undefined;
  let resolveSource = (_source: string) => {};
  let requestStarted = () => {};
  const started = new Promise<void>((resolve) => requestStarted = resolve);
  const response = new Promise<string>((resolve) => resolveSource = resolve);
  const originalBindings = Object.getOwnPropertyDescriptor(globalThis, "bindings");
  const originalRequire = Object.getOwnPropertyDescriptor(globalThis, "require");
  const originalMonaco = Object.getOwnPropertyDescriptor(globalThis, "monaco");
  Object.defineProperties(globalThis, {
    bindings: {
      configurable: true,
      value: {
        getSource() {
          requestStarted();
          return response;
        },
      },
    },
    require: { configurable: true, value: fakeEditor.amdRequire },
    monaco: { configurable: true, value: fakeEditor.monaco },
  });
  try {
    flushSync(() =>
      root.render(
        <SourceEditorHarness
          store={store}
          receiveActions={(nextActions) => actions = nextActions}
        />,
      )
    );
    assertExists(actions);
    const loading = actions.loadSource();
    await started;

    fakeEditor.edit("const editedWhileLoading = true;");
    resolveSource("const responseArrivedLate = true;");
    await loading;

    assertEquals(fakeEditor.getValue(), "const editedWhileLoading = true;");
    assertEquals(store.getState().source, "const editedWhileLoading = true;");
    assertEquals(store.getState().savedSource, "const saved = true;");
    assertEquals(store.getState().sourceDirty, true);
    assertEquals(store.getState().sourceStatus, "未保存の編集を保持しました。");
  } finally {
    if (originalBindings) {
      Object.defineProperty(globalThis, "bindings", originalBindings);
    } else {
      delete (globalThis as Record<string, unknown>).bindings;
    }
    if (originalRequire) {
      Object.defineProperty(globalThis, "require", originalRequire);
    } else {
      delete (globalThis as Record<string, unknown>).require;
    }
    if (originalMonaco) {
      Object.defineProperty(globalThis, "monaco", originalMonaco);
    } else {
      delete (globalThis as Record<string, unknown>).monaco;
    }
    flushSync(() => root.unmount());
  }
});

Deno.test("別のエージェントを削除しても選択中の未保存ソースを再読み込みしない", async () => {
  browserWindow.localStorage.clear();
  const store = createAppStore();
  const selected = { path: "versions/selected", name: "v001-selected" };
  const deleted = { path: "versions/deleted", name: "v002-deleted" };
  store.setState({
    dashboard: { projectDir: "/project", versions: [selected, deleted] },
    selected: selected.path,
    source: "const edited = true;",
    savedSource: "const edited = false;",
    sourceDirty: true,
  });
  let loadCount = 0;
  let clearCount = 0;
  const originalBindings = Object.getOwnPropertyDescriptor(globalThis, "bindings");
  Object.defineProperty(globalThis, "bindings", {
    configurable: true,
    value: {
      deleteVersion() {
        return Promise.resolve({ message: "削除しました。" });
      },
      getDashboard() {
        return Promise.resolve({ projectDir: "/project", versions: [selected] });
      },
    },
  });
  try {
    const dashboard = useDashboard(
      store,
      {
        loadSource() {
          loadCount++;
          return Promise.resolve();
        },
        saveIfDirty() {
          return Promise.resolve(true);
        },
        clear() {
          clearCount++;
        },
        layout() {},
      },
      {
        persistHistory() {
          return Promise.resolve(true);
        },
        scroll() {},
      },
      {
        ...testDialogs,
        requestConfirmation() {
          return Promise.resolve(true);
        },
      },
    );
    await dashboard.deleteVersion(deleted);

    assertEquals(loadCount, 0);
    assertEquals(clearCount, 0);
    assertEquals(store.getState().source, "const edited = true;");
    assertEquals(store.getState().savedSource, "const edited = false;");
    assertEquals(store.getState().sourceDirty, true);
  } finally {
    if (originalBindings) {
      Object.defineProperty(globalThis, "bindings", originalBindings);
    } else {
      delete (globalThis as Record<string, unknown>).bindings;
    }
  }
});

function ResizeHarness() {
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const [utilityWidth, setUtilityWidth] = useState(520);
  return (
    <>
      <div id="sidebar" />
      <ResizeHandle
        hidden={false}
        side="sidebar"
        label="サイドバーの幅を変更"
        controls="sidebar"
        value={sidebarWidth}
        minimum={240}
        maximum={520}
        defaultValue={280}
        onValueChange={setSidebarWidth}
        onPointerDown={() => {}}
      />
      <ResizeHandle
        hidden={false}
        side="utility"
        label="ツールの幅を変更"
        controls="utility"
        value={utilityWidth}
        minimum={340}
        maximum={760}
        defaultValue={520}
        onValueChange={setUtilityWidth}
        onPointerDown={() => {}}
      />
      <div id="utility" />
    </>
  );
}

Deno.test("リサイズバーは現在幅を伝えてキーボードで変更できる", () => {
  const { host, root } = createTestRoot();
  try {
    flushSync(() => root.render(<ResizeHarness />));
    const sidebar = host.querySelector<HTMLElement>('[aria-label="サイドバーの幅を変更"]');
    const utility = host.querySelector<HTMLElement>('[aria-label="ツールの幅を変更"]');
    assertExists(sidebar);
    assertExists(utility);
    assertEquals(sidebar.getAttribute("role"), "separator");
    assertEquals(sidebar.getAttribute("aria-orientation"), "vertical");
    assertEquals(sidebar.getAttribute("aria-controls"), "sidebar");
    assertEquals(sidebar.getAttribute("aria-valuenow"), "280");

    const growSidebar = new KeyboardEvent("keydown", {
      key: "ArrowRight",
      bubbles: true,
      cancelable: true,
    });
    flushSync(() => sidebar.dispatchEvent(growSidebar));
    assertEquals(growSidebar.defaultPrevented, true);
    assertEquals(sidebar.getAttribute("aria-valuenow"), "292");

    flushSync(() => {
      sidebar.dispatchEvent(new KeyboardEvent("keydown", { key: "Home", bubbles: true }));
    });
    assertEquals(sidebar.getAttribute("aria-valuenow"), "240");
    flushSync(() => sidebar.dispatchEvent(new MouseEvent("dblclick", { bubbles: true })));
    assertEquals(sidebar.getAttribute("aria-valuenow"), "280");

    flushSync(() => {
      utility.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
    });
    assertEquals(utility.getAttribute("aria-valuenow"), "532");
  } finally {
    flushSync(() => root.unmount());
  }
});

Deno.test("通常Dialogは入力へフォーカスしEscで呼び出し元へ戻す", async () => {
  const { host, root } = createTestRoot();
  try {
    flushSync(() => root.render(<DialogHarness />));
    const trigger = host.querySelector<HTMLButtonElement>('[data-trigger="text"]');
    assertExists(trigger);
    trigger.focus();
    flushSync(() => trigger.click());
    await browserWindow.happyDOM.waitUntilComplete();

    const dialog = testDocument.querySelector('[role="dialog"]');
    const input = testDocument.querySelector<HTMLInputElement>(
      'input[name="agent-name"]',
    );
    assertExists(dialog);
    assertExists(input);
    assertEquals(input.value, "テストAI");
    assertEquals(testDocument.activeElement === input, true);

    flushSync(() => {
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    await browserWindow.happyDOM.waitUntilComplete();
    assertEquals(testDocument.querySelector('[role="dialog"]'), null);
    assertEquals(testDocument.activeElement === trigger, true);
  } finally {
    flushSync(() => root.unmount());
  }
});

Deno.test("破壊的な確認はAlert Dialogとしてキャンセルできる", async () => {
  const { host, root } = createTestRoot();
  try {
    confirmationResult = null;
    flushSync(() => root.render(<DialogHarness />));
    const trigger = host.querySelector<HTMLButtonElement>('[data-trigger="confirm"]');
    assertExists(trigger);
    trigger.focus();
    flushSync(() => trigger.click());
    await browserWindow.happyDOM.waitUntilComplete();

    const alertDialog = testDocument.querySelector('[role="alertdialog"]');
    const cancel = alertDialog?.querySelector<HTMLButtonElement>("button");
    assertExists(alertDialog);
    assertExists(cancel);
    flushSync(() => cancel.click());
    await browserWindow.happyDOM.waitUntilComplete();

    assertEquals(testDocument.querySelector('[role="alertdialog"]'), null);
    assertEquals(confirmationResult, false);
    assertEquals(testDocument.activeElement === trigger, true);
  } finally {
    flushSync(() => root.unmount());
  }
});
