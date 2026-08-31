import { type RefObject, useRef } from "react";
import { callDesktop } from "../api.ts";
import { canApplyLoadedSource } from "../source-load.ts";
import { errorMessage } from "./helpers.ts";
import type { AppStore } from "./use-app-store.tsx";
import { useMonacoEditor } from "./use-monaco-editor.ts";

export function useSourceEditor(
  store: AppStore,
  sourceEditorRef: RefObject<HTMLDivElement | null>,
  darkMode: boolean,
) {
  const reloadingRef = useRef(false);
  const reloadPendingRef = useRef(false);
  const editRevisionRef = useRef(0);
  const loadRequestRef = useRef(0);
  const { updateShell, updateSource } = store.getState();
  const editor = useMonacoEditor({
    containerRef: sourceEditorRef,
    darkMode,
    onChange: (source) => {
      editRevisionRef.current++;
      const current = store.getState();
      updateSource({
        source,
        sourceDirty: source !== current.savedSource,
      });
    },
    onSave: () => void saveSource(),
  });

  async function loadSource(versionPath = store.getState().selected) {
    const request = ++loadRequestRef.current;
    const requestedRevision = editRevisionRef.current;
    if (!versionPath) {
      updateSource({ source: "", savedSource: "", sourceDirty: false, sourceStatus: "" });
      await editor.ready();
      if (request !== loadRequestRef.current || store.getState().selected) return;
      editor.setValue("");
      return;
    }
    updateSource({ sourceStatus: "読み込み中…" });
    try {
      const source = await callDesktop<string>("getSource", [versionPath]);
      await editor.ready();
      const current = store.getState();
      if (
        !canApplyLoadedSource({
          currentRequest: loadRequestRef.current,
          currentRevision: editRevisionRef.current,
          dirty: current.sourceDirty,
          requestedRevision,
          request,
          selected: current.selected,
          versionPath,
        })
      ) {
        if (
          current.selected === versionPath && request === loadRequestRef.current &&
          (current.sourceDirty || requestedRevision !== editRevisionRef.current)
        ) {
          updateSource({ sourceStatus: "未保存の編集を保持しました。" });
        }
        return;
      }
      updateSource({ source, savedSource: source, sourceDirty: false });
      editor.setValue(source);
      editor.layout();
      updateSource({ sourceStatus: "" });
    } catch (error) {
      if (
        store.getState().selected === versionPath &&
        request === loadRequestRef.current
      ) {
        updateSource({ sourceStatus: `エラー: ${errorMessage(error)}` });
      }
    }
  }

  async function saveSource(): Promise<boolean> {
    const current = store.getState();
    if (!current.selected || current.busy) return false;
    const versionPath = current.selected;
    updateShell({ busy: true });
    updateSource({ sourceStatus: "保存しています…" });
    try {
      await editor.ready();
      const source = editor.getValue();
      updateSource({ source });
      const result = await callDesktop<{ message: string }>("saveSource", [
        versionPath,
        source,
      ]);
      const latest = store.getState();
      if (latest.selected === versionPath) {
        updateSource({
          savedSource: source,
          sourceDirty: editor.getValue() !== source,
          sourceStatus: result.message,
        });
      }
      return true;
    } catch (error) {
      updateSource({ sourceStatus: `エラー: ${errorMessage(error)}` });
      return false;
    } finally {
      updateShell({ busy: false });
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
