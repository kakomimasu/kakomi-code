import { assertEquals } from "@std/assert";
import { createAppStore } from "../desktop/ui/hooks/use-app-state.ts";

Deno.test("Zustandストアは共有状態を更新して購読者へ通知する", () => {
  const originalLocalStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  try {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: { getItem: () => null, setItem: () => {} },
    });
    const store = createAppStore();
    const selectedValues: string[] = [];
    const unsubscribe = store.subscribe((state) => selectedValues.push(state.selected));

    store.setState({ selected: "versions/test-agent" });
    store.setState((state) => ({ busy: !state.busy }));

    assertEquals(store.getState().selected, "versions/test-agent");
    assertEquals(store.getState().busy, true);
    assertEquals(selectedValues, ["versions/test-agent", "versions/test-agent"]);
    unsubscribe();
  } finally {
    if (originalLocalStorage) {
      Object.defineProperty(globalThis, "localStorage", originalLocalStorage);
    } else {
      delete (globalThis as Record<string, unknown>).localStorage;
    }
  }
});
