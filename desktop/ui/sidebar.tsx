import { classes, CopyIcon, DeleteIcon, EditIcon } from "./common.tsx";
import { appIconUrl } from "./assets.ts";
import type { AppProps, Version } from "./types.ts";

function VersionRow({ app, version }: AppProps & { version: Version }) {
  return (
    <div className={classes("version-row", app.selected === version.path && "active")}>
      <button
        type="button"
        className="version-item"
        onClick={() => app.selectVersion(version.path)}
      >
        {app.displayName(version.name)}
      </button>
      <button
        type="button"
        className="rename-version version-action"
        onClick={() => app.renameVersion(version)}
        disabled={app.busy}
        title="名前を変更"
        aria-label="名前を変更"
      >
        <EditIcon />
      </button>
      <button
        type="button"
        className="copy-version version-action"
        onClick={() => app.createVersion(version.path)}
        disabled={app.busy}
        title="この版を複製"
        aria-label="この版を複製"
      >
        <CopyIcon />
      </button>
      <button
        type="button"
        className="delete-version"
        onClick={() => app.deleteVersion(version)}
        disabled={app.busy}
        title="この版を削除"
        aria-label="この版を削除"
      >
        <DeleteIcon />
      </button>
    </div>
  );
}

export function Sidebar({ app }: AppProps) {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <img src={appIconUrl} alt="" />
        <div>
          <h1>囲みコード</h1>
        </div>
      </div>
      <section className="sidebar-section">
        <div className="section-heading">
          <h2>エージェント</h2>
          <button
            type="button"
            className="icon-button"
            onClick={() => app.createVersion()}
            disabled={app.busy}
            title="テンプレートをベースに新規作成"
            aria-label="テンプレートをベースに新規作成"
          >
            ＋
          </button>
        </div>
        <div className="version-list">
          {app.dashboard.versions.map((version: Version) => (
            <VersionRow app={app} version={version} key={version.path} />
          ))}
          {app.dashboard.versions.length === 0 && (
            <p className="empty-versions">エージェントがありません。</p>
          )}
        </div>
        <p className="status">{app.status}</p>
      </section>
    </aside>
  );
}
