import { type RefObject, useRef } from "react";
import { callDesktop } from "../api.ts";
import { errorMessage } from "./helpers.ts";
import type { AppStore } from "./use-app-state.ts";
import { useMonacoEditor } from "./use-monaco-editor.ts";

export function useSourceEditor(
  store: AppStore,
  sourceEditorRef: RefObject<HTMLDivElement | null>,
  darkMode: boolean,
) {
  const reloadingRef = useRef(false);
  const reloadPendingRef = useRef(false);
  const editor = useMonacoEditor({
    containerRef: sourceEditorRef,
    darkMode,
    onChange: (source) => store.update({ source }),
    onSave: () => void saveSource(),
  });

  async function loadSource(versionPath = store.read().selected) {
    if (!versionPath) {
      store.update({ source: "", sourceStatus: "" });
      await editor.ready();
      editor.setValue("");
      return;
    }
    store.update({ sourceStatus: "読み込み中…" });
    try {
      const source = await callDesktop<string>("getSource", [versionPath]);
      if (store.read().selected !== versionPath) return;
      store.update({ source });
      await editor.ready();
      if (store.read().selected !== versionPath) return;
      editor.setValue(source);
      editor.layout();
      store.update({ sourceStatus: "" });
    } catch (error) {
      if (store.read().selected === versionPath) {
        store.update({ sourceStatus: `エラー: ${errorMessage(error)}` });
      }
    }
  }

  async function saveSource() {
    const current = store.read();
    if (!current.selected || current.busy) return;
    store.update({ busy: true, sourceStatus: "保存しています…" });
    try {
      await editor.ready();
      const source = editor.getValue();
      store.update({ source });
      const result = await callDesktop<{ message: string }>("saveSource", [
        store.read().selected,
        source,
      ]);
      store.update({ sourceStatus: result.message });
    } catch (error) {
      store.update({ sourceStatus: `エラー: ${errorMessage(error)}` });
    } finally {
      store.update({ busy: false });
    }
  }

  async function reloadSource(versionPath: string) {
    if (reloadingRef.current) {
      reloadPendingRef.current = true;
      return;
    }
    reloadingRef.current = true;
    try {
      do {
        reloadPendingRef.current = false;
        await loadSource(versionPath);
      } while (reloadPendingRef.current && store.read().selected === versionPath);
    } finally {
      reloadingRef.current = false;
    }
  }

  return {
    loadSource,
    saveSource,
    reloadSource,
    clear: () => editor.setValue(""),
    layout: editor.layout,
  };
}
