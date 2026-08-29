import { useRef } from "react";
import { useStore } from "zustand";
import { createStore, type StoreApi } from "zustand/vanilla";
import type {
  CodingAgent,
  CodingLogEntry,
  Dashboard,
  MessagesByVersion,
  UtilityTab,
  ViewerState,
} from "../types.ts";

const SAVED_AGENT_KEY = "kakomimasu-agent";
const SAVED_MODELS_KEY = "kakomimasu-models";

export type Models = Record<CodingAgent, string>;

export type AppState = {
  dashboard: Dashboard;
  selected: string;
  tab: UtilityTab;
  agent: CodingAgent;
  models: Models;
  messagesByVersion: MessagesByVersion;
  codingLogs: CodingLogEntry[];
  codingAgentResult: { versionDir: string; text: string } | null;
  matchLogs: string[];
  source: string;
  savedSource: string;
  sourceDirty: boolean;
  sourceStatus: string;
  idea: string;
  status: string;
  matchStatus: string;
  matchRunning: boolean;
  viewerUrl: string;
  viewerOpen: boolean;
  viewerLoading: boolean;
  viewerStates: Record<string, ViewerState>;
  matchVersion: string;
  ai: string;
  board: string;
  busy: boolean;
  codingAgentRunning: boolean;
  stopping: boolean;
  matchStopping: boolean;
};

export type AppStore = StoreApi<AppState>;

function savedAgent(): CodingAgent {
  const saved = localStorage.getItem(SAVED_AGENT_KEY);
  return saved === "claude" || saved === "opencode" ? saved : "codex";
}

function savedModels(): Models {
  const defaults: Models = { codex: "gpt-5.6-luna", claude: "haiku", opencode: "" };
  try {
    const parsed = JSON.parse(localStorage.getItem(SAVED_MODELS_KEY) || "{}") as
      | Partial<Models>
      | null;
    for (const agent of Object.keys(defaults) as CodingAgent[]) {
      const value = parsed?.[agent];
      if (
        typeof value === "string" &&
        (!value || /^[A-Za-z0-9][A-Za-z0-9._:/~-]*$/.test(value))
      ) {
        defaults[agent] = value;
      }
    }
  } catch {
    // 壊れた保存値はデフォルトに戻す。
  }
  return defaults;
}

function initialState(): AppState {
  return {
    dashboard: { projectDir: "", versions: [] },
    selected: "",
    tab: "source",
    agent: savedAgent(),
    models: savedModels(),
    messagesByVersion: {},
    codingLogs: [],
    codingAgentResult: null,
    matchLogs: [],
    source: "",
    savedSource: "",
    sourceDirty: false,
    sourceStatus: "",
    idea: "",
    status: "",
    matchStatus: "",
    matchRunning: false,
    viewerUrl: "",
    viewerOpen: false,
    viewerLoading: false,
    viewerStates: {},
    matchVersion: "",
    ai: "a1",
    board: "A-1",
    busy: false,
    codingAgentRunning: false,
    stopping: false,
    matchStopping: false,
  };
}

export function createAppStore(): AppStore {
  return createStore<AppState>()(() => initialState());
}

export function useAppState() {
  const storeRef = useRef<AppStore | null>(null);
  if (!storeRef.current) storeRef.current = createAppStore();
  const store = storeRef.current;
  const state = useStore(store);
  return { state, store };
}

export function saveAgentPreference(agent: CodingAgent) {
  localStorage.setItem(SAVED_AGENT_KEY, agent);
}

export function saveModelPreferences(models: Models) {
  localStorage.setItem(SAVED_MODELS_KEY, JSON.stringify(models));
}
