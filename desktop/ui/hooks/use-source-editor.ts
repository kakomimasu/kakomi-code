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
    onChange: (source) =>
      store.setState((current) => ({
        source,
        sourceDirty: source !== current.savedSource,
      })),
    onSave: () => void saveSource(),
  });

  async function loadSource(versionPath = store.getState().selected) {
    if (!versionPath) {
      store.setState({ source: "", savedSource: "", sourceDirty: false, sourceStatus: "" });
      await editor.ready();
      editor.setValue("");
      return;
    }
    store.setState({ sourceStatus: "読み込み中…" });
    try {
      const source = await callDesktop<string>("getSource", [versionPath]);
      if (store.getState().selected !== versionPath) return;
      store.setState({ source, savedSource: source, sourceDirty: false });
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

  async function saveSource(): Promise<boolean> {
    const current = store.getState();
    if (!current.selected || current.busy) return false;
    const versionPath = current.selected;
    store.setState({ busy: true, sourceStatus: "保存しています…" });
    try {
      await editor.ready();
      const source = editor.getValue();
      store.setState({ source });
      const result = await callDesktop<{ message: string }>("saveSource", [
        versionPath,
        source,
      ]);
      const latest = store.getState();
      if (latest.selected === versionPath) {
        store.setState({
          savedSource: source,
          sourceDirty: editor.getValue() !== source,
          sourceStatus: result.message,
        });
      }
      return true;
    } catch (error) {
      store.setState({ sourceStatus: `エラー: ${errorMessage(error)}` });
      return false;
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
    async saveIfDirty() {
      return !store.getState().sourceDirty || await saveSource();
    },
    reloadSource,
    clear: () => editor.setValue(""),
    layout: editor.layout,
  };
}
