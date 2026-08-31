import { type KeyboardEvent, useRef } from "react";
import type { CodingAgent } from "../types.ts";
import { type AppStore, saveAgentPreference, saveModelPreferences } from "./use-app-state.ts";

export function useChatComposer(store: AppStore, improve: () => Promise<void>) {
  const composition = useRef({ active: false, guardUntil: 0 }).current;

  function sendOnEnter(event: KeyboardEvent<HTMLTextAreaElement>) {
    const duringComposition = composition.active || event.nativeEvent.isComposing ||
      event.keyCode === 229 || event.key === "Process";
    if (event.key !== "Enter") return;
    if (event.shiftKey || duringComposition || performance.now() < composition.guardUntil) return;
    event.preventDefault();
    void improve();
  }

  return {
    startComposition() {
      composition.active = true;
      composition.guardUntil = 0;
    },
    endComposition() {
      composition.active = false;
      composition.guardUntil = performance.now() + 150;
    },
    clearCompositionGuard: () => composition.guardUntil = 0,
    sendOnEnter,
    setIdea: (idea: string) => store.setState({ idea }),
    selectAgent(agent: CodingAgent) {
      store.setState({ agent });
      saveAgentPreference(agent);
    },
    setModel(model: string) {
      store.setState((current) => ({ models: { ...current.models, [current.agent]: model } }));
    },
    saveModel() {
      const current = store.getState();
      const value = (current.models[current.agent] || "").trim();
      const model = value && !/^[A-Za-z0-9][A-Za-z0-9._:/~-]*$/.test(value) ? "" : value;
      const models = { ...current.models, [current.agent]: model };
      store.setState({ models });
      saveModelPreferences(models);
    },
  };
}
