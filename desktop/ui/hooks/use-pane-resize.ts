import { type PointerEventHandler, useRef, useState } from "react";

function savedWidth(key: string, fallback: number) {
  return Number(localStorage.getItem(key)) || fallback;
}

export function usePaneResize() {
  const [sidebarWidth, setSidebarWidth] = useState(() =>
    savedWidth("kakomimasu-sidebar-width", 280)
  );
  const [utilityWidth, setUtilityWidth] = useState(() =>
    savedWidth("kakomimasu-utility-width", 520)
  );
  const sidebarWidthRef = useRef(sidebarWidth);
  const utilityWidthRef = useRef(utilityWidth);
  sidebarWidthRef.current = sidebarWidth;
  utilityWidthRef.current = utilityWidth;

  const startResize: PointerEventHandler<HTMLDivElement> = (event) => {
    const move = (pointerEvent: PointerEvent) => {
      const width = Math.max(240, Math.min(520, pointerEvent.clientX));
      sidebarWidthRef.current = width;
      setSidebarWidth(width);
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
      const minimumCenterWidth = 320;
      const availableWidth = globalThis.innerWidth - sidebarWidthRef.current -
        minimumCenterWidth - 12;
      const maximumWidth = Math.max(340, Math.min(760, availableWidth));
      const requestedWidth = globalThis.innerWidth - pointerEvent.clientX;
      const width = Math.max(340, Math.min(maximumWidth, requestedWidth));
      utilityWidthRef.current = width;
      setUtilityWidth(width);
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

  return { sidebarWidth, utilityWidth, startResize, startUtilityResize };
}
