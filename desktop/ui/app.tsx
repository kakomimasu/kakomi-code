import type { CSSProperties } from "react";
import { appIconUrl } from "./assets.ts";
import { ChatPane } from "./chat.tsx";
import { AppDialog, useDialogController } from "./dialogs.tsx";
import { AppStoreProvider } from "./hooks/use-app-store.tsx";
import { useKakomiApp } from "./hooks/use-kakomi-app.ts";
import { PANE_WIDTHS } from "./hooks/use-pane-resize.ts";
import { ResizeHandle } from "./primitives.tsx";
import { Sidebar } from "./sidebar.tsx";
import { UtilityPane } from "./utility.tsx";

function EmptyWorkspace({ hidden }: { hidden: boolean }) {
  return (
    <section className="empty-workspace" hidden={hidden}>
      <div className="empty-workspace-card">
        <img src={appIconUrl} alt="" />
        <h2>エージェントを選択または作成してください</h2>
        <p>
          左の＋ボタンからエージェントを作成すると、チャットとソースコードを使えるようになります。
        </p>
      </div>
    </section>
  );
}

function AppContent() {
  const dialogs = useDialogController();
  const app = useKakomiApp(dialogs);
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
        controls="agent-sidebar"
        value={app.sidebarWidth}
        minimum={PANE_WIDTHS.sidebar.min}
        maximum={PANE_WIDTHS.sidebar.max}
        defaultValue={PANE_WIDTHS.sidebar.default}
        onValueChange={app.resizeSidebar}
        onPointerDown={(event) => app.startResize(event)}
      />
      <ChatPane app={app} />
      <ResizeHandle
        hidden={noSelection}
        side="utility"
        label="ソースと対戦ペインの幅を変更"
        controls="utility-pane"
        value={app.utilityWidth}
        minimum={PANE_WIDTHS.utility.min}
        maximum={PANE_WIDTHS.utility.max}
        defaultValue={PANE_WIDTHS.utility.default}
        onValueChange={app.resizeUtility}
        onPointerDown={(event) => app.startUtilityResize(event)}
      />
      <UtilityPane app={app} />
      <EmptyWorkspace hidden={!noSelection} />
      <AppDialog controller={dialogs} />
    </main>
  );
}

export function App() {
  return (
    <AppStoreProvider>
      <AppContent />
    </AppStoreProvider>
  );
}
