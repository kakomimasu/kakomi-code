import type { DialogActions } from "../dialogs.tsx";
import type { AppStore } from "./use-app-state.ts";
import { type DashboardSourceActions, useDashboardNavigation } from "./use-dashboard-navigation.ts";
import { useVersionActions } from "./use-version-actions.ts";

type ChatActions = {
  persistHistory(): Promise<boolean>;
  scroll(force?: boolean): void;
};

export function useDashboard(
  store: AppStore,
  source: DashboardSourceActions,
  chat: ChatActions,
  dialogs: DialogActions,
) {
  const navigation = useDashboardNavigation(store, source, chat.scroll);
  const versions = useVersionActions({
    store,
    source,
    persistHistory: chat.persistHistory,
    dialogs,
    refresh: navigation.refresh,
  });

  return { ...navigation, ...versions };
}
