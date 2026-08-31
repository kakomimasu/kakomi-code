import { callDesktop } from "../api.ts";
import type { DialogActions } from "../dialogs.tsx";
import type { Version } from "../types.ts";
import { loadViewerState } from "../viewer.ts";
import { displayVersionName, errorMessage } from "./helpers.ts";
import type { AppStore } from "./use-app-state.ts";
import type { DashboardSourceActions } from "./use-dashboard-navigation.ts";

type VersionActionOptions = {
  store: AppStore;
  source: Pick<DashboardSourceActions, "loadSource" | "saveIfDirty" | "clear">;
  persistHistory(): Promise<boolean>;
  dialogs: DialogActions;
  refresh(preferred?: string): Promise<void>;
};

export function useVersionActions(options: VersionActionOptions) {
  const { store, source, persistHistory, dialogs, refresh } = options;

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
    if (!await source.saveIfDirty()) return;
    store.setState({ busy: true, status: "コピー中…" });
    try {
      const result = await callDesktop<{ version: Version }>("createVersion", [{
        agentName: name.trim(),
        ...(sourceVersion ? { sourceVersion } : {}),
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
    if (!await source.saveIfDirty()) return;
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
      const saved = await persistHistory();
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
    const deletedSelected = store.getState().selected === version.path;
    try {
      await callDesktop("deleteVersion", [version.path]);
      const messagesByVersion = { ...store.getState().messagesByVersion };
      delete messagesByVersion[version.path];
      store.setState({ messagesByVersion });
      await refresh();
      const viewerStates = { ...store.getState().viewerStates };
      delete viewerStates[version.path];
      store.setState({ viewerStates });
      if (deletedSelected) {
        store.setState({
          source: "",
          savedSource: "",
          sourceDirty: false,
          sourceStatus: "",
        });
        source.clear();
        await source.loadSource();
      } else if (!store.getState().sourceDirty) {
        await source.loadSource();
      }
      const saved = await persistHistory();
      store.setState({
        status: name +
          (saved ? " を削除しました。" : " を削除しましたが、チャット履歴を保存できませんでした。"),
      });
    } catch (error) {
      store.setState({ status: `エラー: ${errorMessage(error)}` });
    }
  }

  return { createVersion, renameVersion, deleteVersion };
}
