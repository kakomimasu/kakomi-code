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
    onChange: (source) => store.setState({ source }),
    onSave: () => void saveSource(),
  });

  async function loadSource(versionPath = store.getState().selected) {
    if (!versionPath) {
      store.setState({ source: "", sourceStatus: "" });
      await editor.ready();
      editor.setValue("");
      return;
    }
    store.setState({ sourceStatus: "読み込み中…" });
    try {
      const source = await callDesktop<string>("getSource", [versionPath]);
      if (store.getState().selected !== versionPath) return;
      store.setState({ source });
      await editor.ready();
      if (store.getState().selected !== versionPath) return;
      editor.setValue(source);
      editor.layout();
      store.setState({ sourceStatus: "" });
    } catch (error) {
      if (store.getState().selected === versionPath) {
        store.setState({ sourceStatus: `エラー: ${errorMessage(error)}` });
      }
    }
  }

  async function saveSource() {
    const current = store.getState();
    if (!current.selected || current.busy) return;
    store.setState({ busy: true, sourceStatus: "保存しています…" });
    try {
      await editor.ready();
      const source = editor.getValue();
      store.setState({ source });
      const result = await callDesktop<{ message: string }>("saveSource", [
        store.getState().selected,
        source,
      ]);
      store.setState({ sourceStatus: result.message });
    } catch (error) {
      store.setState({ sourceStatus: `エラー: ${errorMessage(error)}` });
    } finally {
      store.setState({ busy: false });
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
      } while (reloadPendingRef.current && store.getState().selected === versionPath);
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
