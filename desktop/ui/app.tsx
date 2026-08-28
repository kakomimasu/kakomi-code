import { type CSSProperties, type PointerEventHandler, useEffect, useRef, useState } from "react";
import { createKakomiApp } from "../ui_state.js";
import { ChatPane } from "./chat.tsx";
import { Sidebar } from "./sidebar.tsx";
import type { KakomiApp } from "./types.ts";
import { UtilityPane } from "./utility.tsx";

function useKakomiApp() {
  const [, setRevision] = useState(0);
  const mounted = useRef(true);
  const appRef = useRef<KakomiApp | null>(null);

  if (!appRef.current) {
    appRef.current = createKakomiApp(() => {
      if (mounted.current) setRevision((revision) => revision + 1);
    });
  }
  const app = appRef.current;

  useEffect(() => {
    mounted.current = true;
    app.init();
    return () => {
      mounted.current = false;
      app.destroy();
    };
  }, [app]);

  return app;
}

function ResizeHandle({
  hidden,
  side,
  label,
  onPointerDown,
}: {
  hidden: boolean;
  side: "sidebar" | "utility";
  label: string;
  onPointerDown: PointerEventHandler<HTMLDivElement>;
}) {
  return (
    <div
      className={`resize-handle ${side}-resize-handle`}
      hidden={hidden}
      role="separator"
      aria-label={label}
      onPointerDown={onPointerDown}
    />
  );
}

function EmptyWorkspace({ hidden }: { hidden: boolean }) {
  return (
    <section className="empty-workspace" hidden={hidden}>
      <div className="empty-workspace-card">
        <img src="/assets/app-icon.png" alt="" />
        <h2>エージェントを選択または作成してください</h2>
        <p>
          左の＋ボタンからエージェントを作成すると、チャットとソースコードを使えるようになります。
        </p>
      </div>
    </section>
  );
}

export function App() {
  const app = useKakomiApp();
  const noSelection = !app.selected;
  const workspaceStyle = {
    "--sidebar-width": `${app.sidebarWidth}px`,
    "--utility-width": `${app.utilityWidth}px`,
  } as CSSProperties;

  return (
    <main className="workspace" style={workspaceStyle}>
      <Sidebar app={app} />
      <ResizeHandle
        hidden={noSelection}
        side="sidebar"
        label="サイドバーの幅を変更"
        onPointerDown={(event) => app.startResize(event)}
      />
      <ChatPane app={app} />
      <ResizeHandle
        hidden={noSelection}
        side="utility"
        label="ソースと対戦ペインの幅を変更"
        onPointerDown={(event) => app.startUtilityResize(event)}
      />
      <UtilityPane app={app} />
      <EmptyWorkspace hidden={!noSelection} />
    </main>
  );
}
