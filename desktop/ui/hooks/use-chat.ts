import { type RefObject, type SyntheticEvent, useRef } from "react";
import type { DialogActions } from "../dialogs.tsx";
import { nextFrame } from "./helpers.ts";
import type { AppStore } from "./use-app-state.ts";
import { useChatComposer } from "./use-chat-composer.ts";
import { useChatHistory } from "./use-chat-history.ts";
import { type ImprovementSourceActions, useImprovement } from "./use-improvement.ts";

export function useChat(
  store: AppStore,
  chatFeedRef: RefObject<HTMLDivElement | null>,
  source: ImprovementSourceActions,
  dialogs: DialogActions,
) {
  const autoScroll = useRef(true);

  function scroll(force = false) {
    void nextFrame(() => {
      const feed = chatFeedRef.current;
      if (!feed || (!force && !autoScroll.current)) return;
      feed.scrollTop = feed.scrollHeight;
      autoScroll.current = true;
    });
  }

  const history = useChatHistory(store, dialogs, scroll);
  const improvement = useImprovement(store, source, history.persistHistory, scroll);
  const composer = useChatComposer(store, improvement.improve);

  function closeOtherTools(event: SyntheticEvent<HTMLDetailsElement>) {
    const openedTool = event.currentTarget;
    if (!openedTool.open) return;
    chatFeedRef.current?.querySelectorAll<HTMLDetailsElement>(".coding-log-tool[open]").forEach(
      (tool) => {
        if (tool !== openedTool) tool.open = false;
      },
    );
  }

  function updateScrollState() {
    const feed = chatFeedRef.current;
    if (!feed) return;
    autoScroll.current = feed.scrollHeight - feed.clientHeight - feed.scrollTop <= 24;
  }

  return {
    ...history,
    ...improvement,
    ...composer,
    scroll,
    closeOtherTools,
    updateScrollState,
  };
}
