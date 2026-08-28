import { callDesktop } from "../api.ts";
import type { DialogActions } from "../dialogs.tsx";
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

export function useDashboard(
  store: AppStore,
  source: SourceActions,
  chat: ChatActions,
  dialogs: DialogActions,
) {
  async function refresh(preferred = "") {
    const dashboard = await callDesktop<Dashboard>("getDashboard");
    const current = store.getState();
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
        store.setState({
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
    store.setState({ dashboard });
  }

  async function selectVersion(path: string) {
    const current = store.getState();
    if (path === current.selected) return;
    const viewerStates = saveViewerState(
      current.viewerStates,
      current.selected,
      current.viewerUrl,
      current.viewerOpen,
    );
    const viewer = loadViewerState(viewerStates, path);
    store.setState({
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
    store.setState({ tab });
    if (tab === "source") {
      await source.loadSource();
      void nextFrame(source.layout);
    }
  }

  async function createVersion(sourceVersion?: string) {
    const current = store.getState();
    const sourceVersionItem = current.dashboard.versions.find((version) =>
      version.path === sourceVersion
    );
    const name = await dialogs.requestText({
      title: sourceVersionItem ? "エージェントを複製" : "エージェントを作成",
      description: sourceVersionItem
        ? "複製するエージェントの新しい名前を入力してください。"
        : "作戦が分かるような名前を入力してください。",
      initialValue: sourceVersionItem ? displayVersionName(sourceVersionItem.name) : "",
      confirmLabel: sourceVersionItem ? "複製" : "作成",
    });
    if (!name?.trim()) return;
    store.setState({ busy: true, status: "コピー中…" });
    try {
      const result = await callDesktop<{ version: Version }>("createVersion", [{
        agentName: name.trim(),
        sourceVersion,
      }]);
      await refresh(result.version.path);
      await source.loadSource(result.version.path);
      store.setState({ status: `${displayVersionName(result.version.name)} を作成しました。` });
    } catch (error) {
      store.setState({ status: `エラー: ${errorMessage(error)}` });
    } finally {
      store.setState({ busy: false });
    }
  }

  async function renameVersion(version: Version) {
    const currentName = displayVersionName(version.name);
    const name = await dialogs.requestText({
      title: "名前を変更",
      description: "エージェントの新しい名前を入力してください。",
      initialValue: currentName,
      confirmLabel: "変更",
    });
    if (!name?.trim() || name.trim() === currentName) return;
    store.setState({ busy: true, status: "名前を変更しています…" });
    try {
      const previousMessages = store.getState().messagesByVersion[version.path];
      const result = await callDesktop<{ version: Version }>("renameVersion", [{
        versionDir: version.path,
        agentName: name.trim(),
      }]);
      if (previousMessages && result.version.path !== version.path) {
        const messagesByVersion = {
          ...store.getState().messagesByVersion,
          [result.version.path]: previousMessages,
        };
        delete messagesByVersion[version.path];
        store.setState({ messagesByVersion });
      }
      await refresh(result.version.path);
      const refreshed = store.getState();
      if (result.version.path !== version.path && refreshed.viewerStates[version.path]) {
        const viewerStates = {
          ...refreshed.viewerStates,
          [result.version.path]: refreshed.viewerStates[version.path],
        };
        delete viewerStates[version.path];
        const viewer = loadViewerState(viewerStates, result.version.path);
        store.setState({
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
      store.setState({
        status: displayVersionName(result.version.name) +
          (saved ? " に変更しました。" : " に変更しましたが、チャット履歴を保存できませんでした。"),
      });
    } catch (error) {
      store.setState({ status: `エラー: ${errorMessage(error)}` });
    } finally {
      store.setState({ busy: false });
    }
  }

  async function deleteVersion(version: Version) {
    const name = displayVersionName(version.name);
    const confirmed = await dialogs.requestConfirmation({
      title: `${name} を削除しますか？`,
      description: "このエージェントのソースコードとチャット履歴が削除されます。元に戻せません。",
      confirmLabel: "削除",
      danger: true,
    });
    if (!confirmed) return;
    try {
      await callDesktop("deleteVersion", [version.path]);
      const messagesByVersion = { ...store.getState().messagesByVersion };
      delete messagesByVersion[version.path];
      store.setState({ messagesByVersion });
      await refresh();
      const viewerStates = { ...store.getState().viewerStates };
      delete viewerStates[version.path];
      store.setState({ viewerStates });
      await source.loadSource();
      const saved = await chat.persistHistory();
      store.setState({
        status: name +
          (saved ? " を削除しました。" : " を削除しましたが、チャット履歴を保存できませんでした。"),
      });
    } catch (error) {
      store.setState({ status: `エラー: ${errorMessage(error)}` });
    }
  }

  return { refresh, selectVersion, selectTab, createVersion, renameVersion, deleteVersion };
}
