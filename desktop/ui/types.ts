import type { createKakomiApp } from "../ui_state.js";

export type KakomiApp = ReturnType<typeof createKakomiApp> & {
  $refs: Record<string, HTMLElement | null>;
};

export type AppProps = { app: KakomiApp };

export type Version = { path: string; name: string };

export type Message = { role: string; text: string };

export type CodingLogEntry = {
  id: string | number;
  kind: string;
  title: string;
  text: string;
  detail?: string;
  status?: string;
};

export type Opponent = { name: string; level: string; description: string };

export type Board = {
  name: string;
  width: number;
  height: number;
  nAgent: number;
  points: number[];
};
