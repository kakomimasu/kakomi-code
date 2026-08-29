import type { KeyboardEvent, PointerEventHandler, RefObject, SyntheticEvent } from "react";

export type CodingAgent = "codex" | "claude" | "opencode";
export type UtilityTab = "source" | "match";

export type Version = { path: string; name: string };
export type Dashboard = { projectDir: string; versions: Version[] };
export type Message = { role: "user" | "assistant"; text: string };
export type MessagesByVersion = Record<string, Message[]>;

export type CodingLogEntry = {
  id: string | number;
  kind: "message" | "tool" | "status";
  title: string;
  text: string;
  detail?: string;
  status?: string;
};

export type Opponent = { name: string; level: string; description: string };
export type ModelOption = { value: string; label: string };

export type Board = {
  name: string;
  width: number;
  height: number;
  nAgent: number;
  points: number[];
};

export type ViewerState = { url: string; open: boolean };

export type KakomiApp = {
  dashboard: Dashboard;
  selected: string;
  tab: UtilityTab;
  agent: CodingAgent;
  model: string;
  modelOptions: ModelOption[];
  messages: Message[];
  messagesBeforeCodingLogs: Message[];
  displayedCodingLogs: CodingLogEntry[];
  codingAgentFinalMessage: Message | null;
  matchLogs: string[];
  idea: string;
  status: string;
  matchStatus: string;
  matchRunning: boolean;
  matchStopping: boolean;
  viewerUrl: string;
  viewerOpen: boolean;
  viewerLoading: boolean;
  ai: string;
  board: string;
  darkMode: boolean;
  busy: boolean;
  codingAgentRunning: boolean;
  stopping: boolean;
  sidebarWidth: number;
  utilityWidth: number;
  boardOptions: Board[];
  opponentOptions: Opponent[];
  selectedOpponent: Opponent;
  selectedBoard: Board;
  sourceStatus: string;
  sourceDirty: boolean;
  chatFeedRef: RefObject<HTMLDivElement | null>;
  matchOutputRef: RefObject<HTMLPreElement | null>;
  sourceEditorRef: RefObject<HTMLDivElement | null>;
  startResize: PointerEventHandler<HTMLDivElement>;
  startUtilityResize: PointerEventHandler<HTMLDivElement>;
  resizeSidebar(width: number): void;
  resizeUtility(width: number): void;
  setIdea(value: string): void;
  setModel(value: string): void;
  setAi(value: string): void;
  setBoard(value: string): void;
  setViewerLoading(value: boolean): void;
  displayName(name: string): string;
  codingLogStatus(status?: string): string;
  closeOtherCodingTools(event: SyntheticEvent<HTMLDetailsElement>): void;
  boardPointColor(point: number): string;
  selectAgent(agent: CodingAgent): void;
  saveModel(): void;
  clearChat(): Promise<void>;
  selectVersion(path: string): Promise<void>;
  selectTab(tab: UtilityTab): Promise<void>;
  createVersion(sourceVersion?: string): Promise<void>;
  renameVersion(version: Version): Promise<void>;
  deleteVersion(version: Version): Promise<void>;
  startComposition(): void;
  endComposition(): void;
  clearCompositionGuard(): void;
  sendOnEnter(event: KeyboardEvent<HTMLTextAreaElement>): void;
  improve(): Promise<void>;
  cancelImprove(): Promise<void>;
  saveSource(): Promise<boolean>;
  startMatch(): Promise<void>;
  stopMatch(): Promise<void>;
  openViewer(): void;
  closeViewer(): void;
  updateChatScrollState(): void;
};

export type AppProps = { app: KakomiApp };
