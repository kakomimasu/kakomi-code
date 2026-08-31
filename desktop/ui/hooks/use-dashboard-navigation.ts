import { callDesktop } from "../api.ts";
import type { Dashboard, UtilityTab } from "../types.ts";
import { loadViewerState, saveViewerState } from "../viewer.ts";
import { nextFrame } from "./helpers.ts";
import type { AppStore } from "./use-app-state.ts";

export type DashboardSourceActions = {
  loadSource(versionPath?: string): Promise<void>;
  saveIfDirty(): Promise<boolean>;
  clear(): void;
  layout(): void;
};

export function useDashboardNavigation(
  store: AppStore,
  source: DashboardSourceActions,
  scrollChat: (force?: boolean) => void,
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
    if (!await source.saveIfDirty()) return;
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
      savedSource: "",
      sourceDirty: false,
      sourceStatus: "",
      codingLogs: [],
    });
    source.clear();
    scrollChat(true);
    if (current.tab === "source") await source.loadSource(path);
  }

  async function selectTab(tab: UtilityTab) {
    const current = store.getState();
    if (tab === current.tab) {
      if (tab === "source") {
        if (!current.sourceDirty) await source.loadSource();
        void nextFrame(source.layout);
      }
      return;
    }
    store.setState({ tab });
    if (tab === "source") {
      if (!current.sourceDirty) await source.loadSource();
      void nextFrame(source.layout);
    }
  }

  return { refresh, selectVersion, selectTab };
}
