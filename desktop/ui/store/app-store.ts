import { createStore, type StoreApi } from "zustand";
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

export type ShellState = {
  status: string;
  busy: boolean;
};

export type WorkspaceState = {
  dashboard: Dashboard;
  selected: string;
  tab: UtilityTab;
};

export type ChatState = {
  agent: CodingAgent;
  models: Models;
  messagesByVersion: MessagesByVersion;
  codingLogs: CodingLogEntry[];
  codingAgentResult: { versionDir: string; text: string } | null;
  idea: string;
  codingAgentRunning: boolean;
  stopping: boolean;
};

export type SourceState = {
  source: string;
  savedSource: string;
  sourceDirty: boolean;
  sourceStatus: string;
};

export type MatchState = {
  matchLogs: string[];
  matchStatus: string;
  matchRunning: boolean;
  matchStopping: boolean;
  viewerUrl: string;
  viewerOpen: boolean;
  viewerLoading: boolean;
  viewerStates: Record<string, ViewerState>;
  matchVersion: string;
  ai: string;
  board: string;
};

export type AppState = ShellState & WorkspaceState & ChatState & SourceState & MatchState;

export type AppActions = {
  updateShell(patch: Partial<ShellState>): void;
  updateWorkspace(patch: Partial<WorkspaceState>): void;
  updateChat(patch: Partial<ChatState>): void;
  updateSource(patch: Partial<SourceState>): void;
  updateMatch(patch: Partial<MatchState>): void;
};

export type AppStoreState = AppState & AppActions;
export type AppStore = StoreApi<AppStoreState>;

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
  return createStore<AppStoreState>()((set) => ({
    ...initialState(),
    updateShell: (patch) => set(patch),
    updateWorkspace: (patch) => set(patch),
    updateChat: (patch) => set(patch),
    updateSource: (patch) => set(patch),
    updateMatch: (patch) => set(patch),
  }));
}

export function saveAgentPreference(agent: CodingAgent) {
  localStorage.setItem(SAVED_AGENT_KEY, agent);
}

export function saveModelPreferences(models: Models) {
  localStorage.setItem(SAVED_MODELS_KEY, JSON.stringify(models));
}
