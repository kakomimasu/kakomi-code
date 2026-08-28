import { type PointerEventHandler, useRef, useState } from "react";

export const PANE_WIDTHS = {
  sidebar: { default: 280, min: 240, max: 520 },
  utility: { default: 520, min: 340, max: 760 },
} as const;

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}

function savedWidth(key: string, fallback: number) {
  return Number(localStorage.getItem(key)) || fallback;
}

export function usePaneResize() {
  const [sidebarWidth, setSidebarWidth] = useState(() =>
    clamp(
      savedWidth("kakomimasu-sidebar-width", PANE_WIDTHS.sidebar.default),
      PANE_WIDTHS.sidebar.min,
      PANE_WIDTHS.sidebar.max,
    )
  );
  const [utilityWidth, setUtilityWidth] = useState(() =>
    clamp(
      savedWidth("kakomimasu-utility-width", PANE_WIDTHS.utility.default),
      PANE_WIDTHS.utility.min,
      PANE_WIDTHS.utility.max,
    )
  );
  const sidebarWidthRef = useRef(sidebarWidth);
  const utilityWidthRef = useRef(utilityWidth);
  sidebarWidthRef.current = sidebarWidth;
  utilityWidthRef.current = utilityWidth;

  function maximumUtilityWidth() {
    const minimumCenterWidth = 320;
    const availableWidth = globalThis.innerWidth - sidebarWidthRef.current -
      minimumCenterWidth - 12;
    return Math.max(
      PANE_WIDTHS.utility.min,
      Math.min(PANE_WIDTHS.utility.max, availableWidth),
    );
  }

  function applySidebarWidth(width: number) {
    const nextWidth = clamp(width, PANE_WIDTHS.sidebar.min, PANE_WIDTHS.sidebar.max);
    sidebarWidthRef.current = nextWidth;
    setSidebarWidth(nextWidth);
    return nextWidth;
  }

  function applyUtilityWidth(width: number) {
    const nextWidth = clamp(width, PANE_WIDTHS.utility.min, maximumUtilityWidth());
    utilityWidthRef.current = nextWidth;
    setUtilityWidth(nextWidth);
    return nextWidth;
  }

  function resizeSidebar(width: number) {
    localStorage.setItem("kakomimasu-sidebar-width", String(applySidebarWidth(width)));
  }

  function resizeUtility(width: number) {
    localStorage.setItem("kakomimasu-utility-width", String(applyUtilityWidth(width)));
  }

  const startResize: PointerEventHandler<HTMLDivElement> = (event) => {
    const move = (pointerEvent: PointerEvent) => {
      applySidebarWidth(pointerEvent.clientX);
    };
    const stop = () => {
      globalThis.removeEventListener("pointermove", move);
      globalThis.removeEventListener("pointerup", stop);
      localStorage.setItem("kakomimasu-sidebar-width", String(sidebarWidthRef.current));
    };
    globalThis.addEventListener("pointermove", move);
    globalThis.addEventListener("pointerup", stop);
    event.preventDefault();
  };

  const startUtilityResize: PointerEventHandler<HTMLDivElement> = (event) => {
    const move = (pointerEvent: PointerEvent) => {
      const requestedWidth = globalThis.innerWidth - pointerEvent.clientX;
      applyUtilityWidth(requestedWidth);
    };
    const stop = () => {
      globalThis.removeEventListener("pointermove", move);
      globalThis.removeEventListener("pointerup", stop);
      localStorage.setItem("kakomimasu-utility-width", String(utilityWidthRef.current));
    };
    globalThis.addEventListener("pointermove", move);
    globalThis.addEventListener("pointerup", stop);
    event.preventDefault();
  };

  return {
    sidebarWidth,
    utilityWidth,
    startResize,
    startUtilityResize,
    resizeSidebar,
    resizeUtility,
  };
}
