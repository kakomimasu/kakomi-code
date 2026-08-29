import { classes, CopyIcon, DeleteIcon, EditIcon } from "./common.tsx";
import { appIconUrl } from "./assets.ts";
import { StatusText, TooltipButton } from "./primitives.tsx";
import type { AppProps, Version } from "./types.ts";

function VersionRow({ app, version }: AppProps & { version: Version }) {
  return (
    <div className={classes("version-row", app.selected === version.path && "active")}>
      <button
        type="button"
        className="version-item"
        aria-pressed={app.selected === version.path}
        onClick={() => app.selectVersion(version.path)}
      >
        {app.displayName(version.name)}
      </button>
      <TooltipButton
        className="rename-version version-action"
        onClick={() => app.renameVersion(version)}
        disabled={app.busy || app.matchRunning}
        label="名前を変更"
      >
        <EditIcon />
      </TooltipButton>
      <TooltipButton
        className="copy-version version-action"
        onClick={() => app.createVersion(version.path)}
        disabled={app.busy || app.matchRunning}
        label="この版を複製"
      >
        <CopyIcon />
      </TooltipButton>
      <TooltipButton
        className="delete-version"
        onClick={() => app.deleteVersion(version)}
        disabled={app.busy || app.matchRunning}
        label="この版を削除"
      >
        <DeleteIcon />
      </TooltipButton>
    </div>
  );
}

export function Sidebar({ app }: AppProps) {
  return (
    <aside className="sidebar" id="agent-sidebar">
      <div className="sidebar-brand">
        <img src={appIconUrl} alt="" />
        <div>
          <h1>囲みコード</h1>
        </div>
      </div>
      <section className="sidebar-section">
        <div className="section-heading">
          <h2>エージェント</h2>
          <TooltipButton
            className="icon-button"
            onClick={() => app.createVersion()}
            disabled={app.busy || app.matchRunning}
            label="テンプレートをベースに新規作成"
          >
            ＋
          </TooltipButton>
        </div>
        <div className="version-list">
          {app.dashboard.versions.map((version: Version) => (
            <VersionRow app={app} version={version} key={version.path} />
          ))}
          {app.dashboard.versions.length === 0 && (
            <p className="empty-versions">エージェントがありません。</p>
          )}
        </div>
        <StatusText>{app.status}</StatusText>
      </section>
    </aside>
  );
}
