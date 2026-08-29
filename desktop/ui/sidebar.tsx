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
      <div className="mx-1 mt-0 mb-6 flex items-center gap-2.5 max-[520px]:mb-[18px]">
        <img
          className="h-[30px] w-[30px] rounded-lg shadow-[0_1px_3px_#00000020] dark:shadow-[0_4px_16px_#00000055]"
          src={appIconUrl}
          alt=""
        />
        <div>
          <h1 className="m-0 text-[17px] leading-normal font-[720] tracking-[-0.01em] text-[#242422] dark:text-[#efefeb]">
            囲みコード
          </h1>
        </div>
      </div>
      <section className="pb-3.5">
        <div className="flex items-center justify-between gap-3 px-1">
          <h2 className="m-0 text-[15px] font-[680] text-[#2c2c2a] dark:text-[#efefeb]">
            エージェント
          </h2>
          <TooltipButton
            className="grid h-7 w-7 place-items-center rounded-lg border-0 bg-transparent p-0 text-[21px] leading-none text-[#656560] transition-[background,color] duration-[120ms] hover:bg-[#e8e8e4] hover:text-[#222220] dark:text-[#c6c6bf] dark:hover:bg-[#30302d] dark:hover:text-[#f2f2ee]"
            onClick={() => app.createVersion()}
            disabled={app.busy || app.matchRunning}
            label="テンプレートをベースに新規作成"
          >
            ＋
          </TooltipButton>
        </div>
        <div className="grid gap-[3px]">
          {app.dashboard.versions.map((version: Version) => (
            <VersionRow app={app} version={version} key={version.path} />
          ))}
          {app.dashboard.versions.length === 0 && (
            <p className="mx-1 my-3 text-[12px] text-[#9a9a95] dark:text-[#a8a8a1]">
              エージェントがありません。
            </p>
          )}
        </div>
        <StatusText>{app.status}</StatusText>
      </section>
    </aside>
  );
}
