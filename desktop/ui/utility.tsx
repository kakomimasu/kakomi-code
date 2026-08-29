import { Tabs } from "@base-ui/react/tabs";
import type { CSSProperties, ReactNode } from "react";
import { classes } from "./common.tsx";
import { Button, StatusText } from "./primitives.tsx";
import type { AppProps, Board, Opponent } from "./types.ts";

type Choice = { name: string };

function ChoiceGroup<T extends Choice>({
  legend,
  className,
  inputName,
  items,
  selected,
  disabled,
  describe,
  onSelect,
}: {
  legend: string;
  className: string;
  inputName: string;
  items: T[];
  selected: string;
  disabled: boolean;
  describe: (item: T) => ReactNode;
  onSelect: (name: string) => void;
}) {
  return (
    <fieldset className="choice-group">
      <legend>{legend}</legend>
      <div className={classes("choice-options", className)}>
        {items.map((item) => (
          <label
            className={classes("choice-card", selected === item.name && "selected")}
            key={item.name}
          >
            <input
              type="radio"
              name={inputName}
              value={item.name}
              checked={selected === item.name}
              onChange={() => onSelect(item.name)}
              disabled={disabled}
            />
            <span>{item.name}</span>
            <small>{describe(item)}</small>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function BoardPreview({ app }: AppProps) {
  const board = app.selectedBoard;
  return (
    <figure className="board-preview">
      <figcaption className="board-preview-heading">
        <span>
          <strong>{board.name}</strong>
          <small>{board.width} × {board.height}</small>
        </span>
        <span className="board-agent-count">{board.nAgent} エージェント</span>
      </figcaption>
      <div
        className="board-grid"
        aria-hidden="true"
        style={{ "--board-columns": board.width } as CSSProperties}
      >
        {board.points.map((point: number, index: number) => (
          <span
            className={classes("board-cell", board.width > 10 && "compact")}
            style={{ backgroundColor: app.boardPointColor(point) }}
            title={`${point}点`}
            key={`${board.name}-${index}`}
          >
            {board.width <= 10 ? point : ""}
          </span>
        ))}
      </div>
      <div className="board-legend" aria-label="盤面の色の説明">
        <span>
          <i className="positive" />プラス
        </span>
        <span>
          <i className="zero" />0
        </span>
        <span>
          <i className="negative" />マイナス
        </span>
      </div>
    </figure>
  );
}

function MatchPanel({ app }: AppProps) {
  const controlsDisabled = app.busy || app.matchRunning;
  return (
    <Tabs.Panel className="tab-panel match-panel" value="match" keepMounted>
      <div className="match-card">
        <div className="match-card-heading">
          <div>
            <h2>対戦しよう</h2>
          </div>
          <span className={classes("match-state", app.matchRunning && "running")}>
            {app.matchRunning ? "対戦中" : "待機中"}
          </span>
        </div>
        <div className="match-form-grid">
          <ChoiceGroup<Opponent>
            legend="対戦相手"
            className="opponent-options"
            inputName="opponent"
            items={app.opponentOptions}
            selected={app.ai}
            disabled={controlsDisabled}
            describe={(opponent) => opponent.level}
            onSelect={(name) => app.setAi(name)}
          />
          <ChoiceGroup<Board>
            legend="盤面"
            className="board-options"
            inputName="board"
            items={app.boardOptions}
            selected={app.board}
            disabled={controlsDisabled}
            describe={(board) => <>{board.width} × {board.height}</>}
            onSelect={(name) => app.setBoard(name)}
          />
        </div>
        <div className="opponent-description" aria-live="polite">
          <span className="opponent-level">{app.selectedOpponent.level}</span>
          <p>{app.selectedOpponent.description}</p>
        </div>
        <BoardPreview app={app} />
        <Button
          type="button"
          size="lg"
          className="mt-4 w-full rounded-[10px]"
          variant={app.matchRunning ? "subtleDanger" : "primary"}
          onClick={() => app.matchRunning ? app.stopMatch() : app.startMatch()}
          disabled={app.matchRunning ? app.matchStopping : controlsDisabled}
        >
          {app.matchRunning ? "対戦を停止" : "対戦を始める"}
        </Button>
        <StatusText>{app.matchStatus}</StatusText>
      </div>
      <section className="match-log-card">
        <h2>対戦中のクライアント出力</h2>
        <pre
          className="output match-output"
          ref={app.matchOutputRef}
        >
          {app.matchLogs.length ? app.matchLogs.join("\n") : "まだ対戦を開始していません。"}
        </pre>
      </section>
    </Tabs.Panel>
  );
}

function SourcePanel({ app }: AppProps) {
  return (
    <Tabs.Panel className="tab-panel source-panel" value="source" keepMounted>
      <div className="source-heading">
        <div>
          <h2>ソースコード</h2>
        </div>
        <Button
          type="button"
          className="min-w-[68px] rounded-[9px]"
          onClick={() => app.saveSource()}
          disabled={app.busy}
        >
          {app.sourceDirty ? "保存 *" : "保存"}
        </Button>
      </div>
      <div
        className="source-output"
        ref={app.sourceEditorRef}
        role="region"
        aria-label="main.ts ソースコードエディタ"
      />
      <StatusText>{app.sourceStatus}</StatusText>
    </Tabs.Panel>
  );
}

export function UtilityPane({ app }: AppProps) {
  return (
    <Tabs.Root
      className="utility-pane"
      id="utility-pane"
      hidden={!app.selected}
      value={app.tab}
      onValueChange={(value) => app.selectTab(value as "source" | "match")}
    >
      <nav className="tabs" aria-label="ツールを選択">
        <Tabs.List className="tab-list" activateOnFocus>
          {(["source", "match"] as const).map((tab) => (
            <Tabs.Tab
              className={(state) => classes("tab", state.active && "active")}
              value={tab}
              key={tab}
            >
              {tab === "source" ? "ソース" : "対戦"}
            </Tabs.Tab>
          ))}
        </Tabs.List>
      </nav>
      <SourcePanel app={app} />
      <MatchPanel app={app} />
    </Tabs.Root>
  );
}
