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

const { useState } = await import("react");
const { flushSync } = await import("react-dom");
const { createRoot } = await import("react-dom/client");
const { ToggleGroup } = await import("@base-ui/react/toggle-group");
const { Tooltip } = await import("@base-ui/react/tooltip");
const { Field } = await import("@base-ui/react/field");
const { AppDialog, useDialogController } = await import("../desktop/ui/dialogs.tsx");
const { AppErrorBoundary } = await import("../desktop/ui/error-boundary.tsx");
const { ModelPicker } = await import("../desktop/ui/model-picker.tsx");
const { ResizeHandle, StatusText, TooltipToggleButton } = await import(
  "../desktop/ui/primitives.tsx"
);

function createTestRoot() {
  browserWindow.document.body.innerHTML = "";
  const happyHost = browserWindow.document.createElement("div");
  browserWindow.document.body.append(happyHost);
  const host = happyHost as unknown as HTMLDivElement;
  return { host, root: createRoot(host) };
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

Deno.test("Fieldは入力欄へラベルと説明を関連付ける", () => {
  const { host, root } = createTestRoot();
  try {
    flushSync(() =>
      root.render(
        <Field.Root>
          <Field.Label>作戦のアイデア</Field.Label>
          <Field.Control render={<textarea defaultValue="守りを固める" />} />
          <Field.Description>Enterで送信します。</Field.Description>
        </Field.Root>,
      )
    );
    const label = host.querySelector<HTMLLabelElement>("label");
    const textarea = host.querySelector<HTMLTextAreaElement>("textarea");
    const description = Array.from(host.querySelectorAll<HTMLElement>("[id]")).find(
      (element) => element.textContent === "Enterで送信します。",
    );
    assertExists(label);
    assertExists(textarea);
    assertExists(description);
    assertEquals(label.htmlFor, textarea.id);
    assertStringIncludes(textarea.getAttribute("aria-describedby") || "", description.id);
    assertEquals(textarea.value, "守りを固める");
  } finally {
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

function ToggleHarness() {
  const [agent, setAgent] = useState<"codex" | "claude" | "opencode">("codex");
  return (
    <Tooltip.Provider delay={0}>
      <ToggleGroup
        aria-label="コーディングAIを選択"
        value={[agent]}
        onValueChange={(agents) => {
          const selected = agents[0];
          if (selected === "codex" || selected === "claude" || selected === "opencode") {
            setAgent(selected);
          }
        }}
      >
        <TooltipToggleButton label="Codex" value="codex">C</TooltipToggleButton>
        <TooltipToggleButton label="Claude Code" value="claude">A</TooltipToggleButton>
        <TooltipToggleButton label="OpenCode" value="opencode">O</TooltipToggleButton>
      </ToggleGroup>
      <output data-agent>{agent}</output>
    </Tooltip.Provider>
  );
}

Deno.test("Toggle GroupはAIを一つだけ選択する", () => {
  const { host, root } = createTestRoot();
  try {
    flushSync(() => root.render(<ToggleHarness />));
    const codex = host.querySelector<HTMLButtonElement>('[aria-label="Codex"]');
    const claude = host.querySelector<HTMLButtonElement>('[aria-label="Claude Code"]');
    const opencode = host.querySelector<HTMLButtonElement>('[aria-label="OpenCode"]');
    assertExists(codex);
    assertExists(claude);
    assertExists(opencode);
    assertEquals(codex.getAttribute("aria-pressed"), "true");
    assertEquals(claude.getAttribute("aria-pressed"), "false");
    assertEquals(opencode.getAttribute("aria-pressed"), "false");

    flushSync(() => claude.click());
    assertEquals(codex.getAttribute("aria-pressed"), "false");
    assertEquals(claude.getAttribute("aria-pressed"), "true");
    assertEquals(host.querySelector("[data-agent]")?.textContent, "claude");

    flushSync(() => opencode.click());
    assertEquals(claude.getAttribute("aria-pressed"), "false");
    assertEquals(opencode.getAttribute("aria-pressed"), "true");
    assertEquals(host.querySelector("[data-agent]")?.textContent, "opencode");

    flushSync(() => opencode.click());
    assertEquals(opencode.getAttribute("aria-pressed"), "true");
    assertEquals(host.querySelector("[data-agent]")?.textContent, "opencode");
  } finally {
    flushSync(() => root.unmount());
  }
});
