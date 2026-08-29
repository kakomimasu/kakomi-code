import { Tooltip } from "@base-ui/react/tooltip";
import type { CSSProperties } from "react";
import { appIconUrl } from "./assets.ts";
import { ChatPane } from "./chat.tsx";
import { AppDialog, useDialogController } from "./dialogs.tsx";
import { useKakomiApp } from "./hooks/use-kakomi-app.ts";
import { PANE_WIDTHS } from "./hooks/use-pane-resize.ts";
import { ResizeHandle } from "./primitives.tsx";
import { Sidebar } from "./sidebar.tsx";
import { UtilityPane } from "./utility.tsx";

function EmptyWorkspace({ hidden }: { hidden: boolean }) {
  return (
    <section className="empty-workspace" hidden={hidden}>
      <div className="w-[min(440px,90%)] px-6 py-8 text-center">
        <img
          className="mb-3.5 h-[42px] w-[42px] rounded-xl shadow-[0_1px_4px_#0000001c] dark:shadow-[0_4px_16px_#00000055]"
          src={appIconUrl}
          alt=""
        />
        <h2 className="m-0 text-[18px] font-bold text-[#343431] dark:text-[#efefeb]">
          エージェントを選択または作成してください
        </h2>
        <p className="mt-2.5 mb-0 text-[13px] leading-[1.7] text-[#858580] dark:text-[#b9b9b2]">
          左の＋ボタンからエージェントを作成すると、チャットとソースコードを使えるようになります。
        </p>
      </div>
    </section>
  );
}

export function App() {
  const dialogs = useDialogController();
  const app = useKakomiApp(dialogs);
  const noSelection = !app.selected;
  const workspaceStyle = {
    "--sidebar-width": `${app.sidebarWidth}px`,
    "--utility-width": `${app.utilityWidth}px`,
  } as CSSProperties;

  return (
    <Tooltip.Provider delay={500}>
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
    </Tooltip.Provider>
  );
}
