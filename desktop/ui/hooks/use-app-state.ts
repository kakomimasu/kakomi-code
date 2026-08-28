import { useRef, useState } from "react";
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
};

export type AppStore = {
  state: AppState;
  read(): AppState;
  update(patch: Partial<AppState> | ((state: AppState) => Partial<AppState>)): void;
};

function savedAgent(): CodingAgent {
  return localStorage.getItem(SAVED_AGENT_KEY) === "claude" ? "claude" : "codex";
}

function savedModels(): Models {
  const defaults: Models = { codex: "gpt-5.6-luna", claude: "haiku" };
  try {
    const parsed = JSON.parse(localStorage.getItem(SAVED_MODELS_KEY) || "{}") as
      | Partial<Models>
      | null;
    for (const agent of Object.keys(defaults) as CodingAgent[]) {
      const value = parsed?.[agent];
      if (typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(value)) {
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
  };
}

export function useAppState(): AppStore {
  const [state, setState] = useState<AppState>(initialState);
  const stateRef = useRef(state);

  return {
    state,
    read: () => stateRef.current,
    update(patch) {
      const current = stateRef.current;
      const changes = typeof patch === "function" ? patch(current) : patch;
      const next = { ...current, ...changes };
      stateRef.current = next;
      setState(next);
    },
  };
}

export function saveAgentPreference(agent: CodingAgent) {
  localStorage.setItem(SAVED_AGENT_KEY, agent);
}

export function saveModelPreferences(models: Models) {
  localStorage.setItem(SAVED_MODELS_KEY, JSON.stringify(models));
}
