import { callDesktop } from "../api.ts";
import type { Dashboard, UtilityTab, Version } from "../types.ts";
import { loadViewerState, saveViewerState } from "../viewer.ts";
import { displayVersionName, errorMessage, nextFrame } from "./helpers.ts";
import type { AppStore } from "./use-app-state.ts";

type SourceActions = {
  loadSource(versionPath?: string): Promise<void>;
  clear(): void;
  layout(): void;
};

type ChatActions = {
  persistHistory(): Promise<boolean>;
  scroll(force?: boolean): void;
};

export function useDashboard(store: AppStore, source: SourceActions, chat: ChatActions) {
  async function refresh(preferred = "") {
    const dashboard = await callDesktop<Dashboard>("getDashboard");
    const current = store.read();
    if (preferred || !dashboard.versions.some((version) => version.path === current.selected)) {
      const selected = preferred || dashboard.versions[0]?.path || "";
      if (selected !== current.selected) {
        const viewerStates = saveViewerState(
          current.viewerStates,
          current.selected,
          current.viewerUrl,
          current.viewerOpen,
        );
        const viewer = loadViewerState(viewerStates, selected);
        store.update({
          dashboard,
          selected,
          viewerStates,
          viewerUrl: viewer.url,
          viewerOpen: viewer.open,
          viewerLoading: viewer.open,
        });
        return;
      }
    }
    store.update({ dashboard });
  }

  async function selectVersion(path: string) {
    const current = store.read();
    if (path === current.selected) return;
    const viewerStates = saveViewerState(
      current.viewerStates,
      current.selected,
      current.viewerUrl,
      current.viewerOpen,
    );
    const viewer = loadViewerState(viewerStates, path);
    store.update({
      selected: path,
      viewerStates,
      viewerUrl: viewer.url,
      viewerOpen: viewer.open,
      viewerLoading: viewer.open,
      source: "",
      sourceStatus: "",
      codingLogs: [],
    });
    source.clear();
    chat.scroll(true);
    if (current.tab === "source") await source.loadSource(path);
  }

  async function selectTab(tab: UtilityTab) {
    store.update({ tab });
    if (tab === "source") {
      await source.loadSource();
      void nextFrame(source.layout);
    }
  }

  async function createVersion(sourceVersion?: string) {
    const current = store.read();
    const sourceVersionItem = current.dashboard.versions.find((version) =>
      version.path === sourceVersion
    );
    const name = prompt(
      "エージェント名を入力してください",
      sourceVersionItem ? displayVersionName(sourceVersionItem.name) : "",
    );
    if (!name?.trim()) return;
    store.update({ busy: true, status: "コピー中…" });
    try {
      const result = await callDesktop<{ version: Version }>("createVersion", [{
        agentName: name.trim(),
        sourceVersion,
      }]);
      await refresh(result.version.path);
      await source.loadSource(result.version.path);
      store.update({ status: `${displayVersionName(result.version.name)} を作成しました。` });
    } catch (error) {
      store.update({ status: `エラー: ${errorMessage(error)}` });
    } finally {
      store.update({ busy: false });
    }
  }

  async function renameVersion(version: Version) {
    const currentName = displayVersionName(version.name);
    const name = prompt("新しいAI名を入力してください", currentName);
    if (!name?.trim() || name.trim() === currentName) return;
    store.update({ busy: true, status: "名前を変更しています…" });
    try {
      const previousMessages = store.read().messagesByVersion[version.path];
      const result = await callDesktop<{ version: Version }>("renameVersion", [{
        versionDir: version.path,
        agentName: name.trim(),
      }]);
      if (previousMessages && result.version.path !== version.path) {
        const messagesByVersion = {
          ...store.read().messagesByVersion,
          [result.version.path]: previousMessages,
        };
        delete messagesByVersion[version.path];
        store.update({ messagesByVersion });
      }
      await refresh(result.version.path);
      const refreshed = store.read();
      if (result.version.path !== version.path && refreshed.viewerStates[version.path]) {
        const viewerStates = {
          ...refreshed.viewerStates,
          [result.version.path]: refreshed.viewerStates[version.path],
        };
        delete viewerStates[version.path];
        const viewer = loadViewerState(viewerStates, result.version.path);
        store.update({
          viewerStates,
          viewerUrl: viewer.url,
          viewerOpen: viewer.open,
          viewerLoading: viewer.open,
          matchVersion: refreshed.matchVersion === version.path
            ? result.version.path
            : refreshed.matchVersion,
        });
      }
      await source.loadSource(result.version.path);
      const saved = await chat.persistHistory();
      store.update({
        status: displayVersionName(result.version.name) +
          (saved ? " に変更しました。" : " に変更しましたが、チャット履歴を保存できませんでした。"),
      });
    } catch (error) {
      store.update({ status: `エラー: ${errorMessage(error)}` });
    } finally {
      store.update({ busy: false });
    }
  }

  async function deleteVersion(version: Version) {
    const name = displayVersionName(version.name);
    if (!confirm(`${name}を削除しますか？`)) return;
    try {
      await callDesktop("deleteVersion", [version.path]);
      const messagesByVersion = { ...store.read().messagesByVersion };
      delete messagesByVersion[version.path];
      store.update({ messagesByVersion });
      await refresh();
      const viewerStates = { ...store.read().viewerStates };
      delete viewerStates[version.path];
      store.update({ viewerStates });
      await source.loadSource();
      const saved = await chat.persistHistory();
      store.update({
        status: name +
          (saved ? " を削除しました。" : " を削除しましたが、チャット履歴を保存できませんでした。"),
      });
    } catch (error) {
      store.update({ status: `エラー: ${errorMessage(error)}` });
    }
  }

  return { refresh, selectVersion, selectTab, createVersion, renameVersion, deleteVersion };
}
