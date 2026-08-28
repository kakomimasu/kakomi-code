import type { CSSProperties, ReactNode } from "react";
import { classes } from "./common.tsx";
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
    <section className="tab-panel match-panel" hidden={app.tab !== "match"}>
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
        <button
          type="button"
          className="match-button"
          onClick={() => app.startMatch()}
          disabled={controlsDisabled}
        >
          対戦を始める
        </button>
        <p className="status">{app.matchStatus}</p>
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
    </section>
  );
}

function SourcePanel({ app }: AppProps) {
  return (
    <section className="tab-panel source-panel" hidden={app.tab !== "source"}>
      <div className="source-heading">
        <div>
          <h2>ソースコード</h2>
        </div>
        <button
          type="button"
          className="source-save-button"
          onClick={() => app.saveSource()}
          disabled={app.busy}
        >
          保存
        </button>
      </div>
      <div
        className="source-output"
        ref={app.sourceEditorRef}
        role="region"
        aria-label="main.ts ソースコードエディタ"
      />
      <p className="status">{app.sourceStatus}</p>
    </section>
  );
}

export function UtilityPane({ app }: AppProps) {
  return (
    <section className="utility-pane" hidden={!app.selected}>
      <nav className="tabs" aria-label="ツールを選択">
        <div className="tab-list">
          {(["source", "match"] as const).map((tab) => (
            <button
              type="button"
              className={classes("tab", app.tab === tab && "active")}
              onClick={() => app.selectTab(tab)}
              key={tab}
            >
              {tab === "source" ? "ソース" : "対戦"}
            </button>
          ))}
        </div>
      </nav>
      <SourcePanel app={app} />
      <MatchPanel app={app} />
    </section>
  );
}
