import { createContext, type ReactNode, useContext, useState } from "react";
import { useStore } from "zustand";
import { useShallow } from "zustand/shallow";
import { type AppStore, type AppStoreState, createAppStore } from "../store/app-store.ts";

export { createAppStore, saveAgentPreference, saveModelPreferences } from "../store/app-store.ts";
export type { AppState, AppStore, AppStoreState, Models } from "../store/app-store.ts";

const AppStoreContext = createContext<AppStore | null>(null);

export function AppStoreProvider({
  children,
  store: providedStore,
}: {
  children: ReactNode;
  store?: AppStore;
}) {
  const [store] = useState(() => providedStore ?? createAppStore());
  return <AppStoreContext.Provider value={store}>{children}</AppStoreContext.Provider>;
}

export function useAppStoreApi(): AppStore {
  const store = useContext(AppStoreContext);
  if (!store) throw new Error("AppStoreProviderがありません。");
  return store;
}

export function useAppStore<Selection>(selector: (state: AppStoreState) => Selection): Selection {
  return useStore(useAppStoreApi(), useShallow(selector));
}
