import { type RefObject, useEffect, useRef } from "react";

type Editor = {
  addCommand(keybinding: number, handler: () => void): void;
  dispose(): void;
  getValue(): string;
  layout(): void;
  onDidChangeModelContent(handler: () => void): void;
  setValue(value: string): void;
};

type MonacoApi = {
  editor: {
    create(container: HTMLElement, options: Record<string, unknown>): Editor;
    setTheme(theme: string): void;
  };
  KeyCode: { KeyS: number };
  KeyMod: { CtrlCmd: number };
};

type AmdRequire = {
  (modules: string[], ready: () => void, failed: () => void): void;
  config(options: { paths: { vs: string } }): void;
};

declare global {
  var monaco: MonacoApi;
  var require: AmdRequire;
}

type Deferred = {
  promise: Promise<void>;
  resolve: () => void;
  reject: (error: Error) => void;
};

function deferred(): Deferred {
  let resolve = () => {};
  let reject = (_error: Error) => {};
  const promise = new Promise<void>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

export function useMonacoEditor({
  containerRef,
  darkMode,
  onChange,
  onSave,
}: {
  containerRef: RefObject<HTMLDivElement | null>;
  darkMode: boolean;
  onChange: (source: string) => void;
  onSave: () => void;
}) {
  const editorRef = useRef<Editor | null>(null);
  const readyRef = useRef<Deferred | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const onChangeRef = useRef(onChange);
  const onSaveRef = useRef(onSave);
  const darkModeRef = useRef(darkMode);
  if (!readyRef.current) readyRef.current = deferred();
  onChangeRef.current = onChange;
  onSaveRef.current = onSave;
  darkModeRef.current = darkMode;

  useEffect(() => {
    const pending = readyRef.current!;
    if (typeof globalThis.require !== "function" || !containerRef.current) {
      pending.reject(new Error("Monaco Editorを読み込めませんでした。"));
      return;
    }
    let disposed = false;
    globalThis.require.config({ paths: { vs: "/vs" } });
    globalThis.require(
      ["vs/editor/editor.main"],
      () => {
        if (disposed || !containerRef.current) return;
        const editor = globalThis.monaco.editor.create(containerRef.current, {
          value: "",
          language: "typescript",
          theme: darkModeRef.current ? "vs-dark" : "vs",
          automaticLayout: true,
          fontFamily: "SFMono-Regular, Menlo, Monaco, Consolas, monospace",
          fontSize: 13,
          lineHeight: 21,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          padding: { top: 12, bottom: 12 },
          tabSize: 2,
          insertSpaces: true,
          wordWrap: "off",
        });
        editorRef.current = editor;
        editor.onDidChangeModelContent(() => onChangeRef.current(editor.getValue()));
        editor.addCommand(
          globalThis.monaco.KeyMod.CtrlCmd | globalThis.monaco.KeyCode.KeyS,
          () => onSaveRef.current(),
        );
        const resizeObserver = new ResizeObserver(() => editor.layout());
        resizeObserver.observe(containerRef.current);
        resizeObserverRef.current = resizeObserver;
        pending.resolve();
      },
      () => pending.reject(new Error("Monaco Editorの初期化に失敗しました。")),
    );
    return () => {
      disposed = true;
      resizeObserverRef.current?.disconnect();
      editorRef.current?.dispose();
      resizeObserverRef.current = null;
      editorRef.current = null;
    };
  }, [containerRef]);

  useEffect(() => {
    if (editorRef.current) globalThis.monaco.editor.setTheme(darkMode ? "vs-dark" : "vs");
  }, [darkMode]);

  return {
    ready: () => readyRef.current!.promise,
    getValue: () => editorRef.current?.getValue() ?? "",
    setValue(value: string) {
      if (editorRef.current?.getValue() !== value) editorRef.current?.setValue(value);
    },
    layout: () => editorRef.current?.layout(),
  };
}
