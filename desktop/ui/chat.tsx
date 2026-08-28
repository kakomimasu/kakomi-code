import { classes } from "./common.tsx";
import type { AppProps, CodingLogEntry, Message } from "./types.ts";

const AGENTS = [
  { id: "codex", label: "Codex", image: "/assets/codex.webp" },
  { id: "claude", label: "Claude Code", image: "/assets/claude.svg" },
] as const;

function ChatMessage({
  message,
  label,
  className,
}: {
  message: Message;
  label?: string;
  className?: string;
}) {
  return (
    <article
      className={classes(
        "message",
        message.role === "user" ? "user-message" : "assistant-message",
        className,
      )}
    >
      <div className="bubble">
        <strong>
          {label ?? (message.role === "user" ? "あなたのアイデア" : "コーディングAI")}
        </strong>
        <pre className="output chat-output">{message.text}</pre>
      </div>
    </article>
  );
}

function CodingLog({ app, log }: AppProps & { log: CodingLogEntry }) {
  if (log.kind === "message") {
    return (
      <ChatMessage
        message={{ role: "assistant", text: log.text }}
        label={`コーディングAI · ${log.title}`}
        className="coding-agent-message"
      />
    );
  }
  if (log.kind === "status") {
    return app.codingAgentRunning
      ? (
        <section className="coding-agent-status">
          <p>{log.text}</p>
        </section>
      )
      : null;
  }
  if (log.kind !== "tool") return null;
  return (
    <section className="coding-log">
      <details
        className="coding-log-tool"
        ref={(element) => {
          if (element && element.dataset.initialized !== "true") {
            element.open = log.status === "in_progress";
            element.dataset.initialized = "true";
          }
        }}
        onToggle={(event) => app.closeOtherCodingTools(event)}
      >
        <summary>
          <span className="coding-log-summary-main">
            <span>{log.title}</span>
            {log.title === "コマンド実行" && <code className="coding-log-command">{log.text}</code>}
          </span>
          <span className="coding-log-state">{app.codingLogStatus(log.status)}</span>
        </summary>
        {log.text && <pre className="coding-log-text">{log.text}</pre>}
        {log.detail && <pre className="coding-log-detail">{log.detail}</pre>}
      </details>
    </section>
  );
}

function AgentPicker({ app }: AppProps) {
  return (
    <div className="agent-picker" aria-label="コーディングAIを選択">
      {AGENTS.map((agent) => (
        <button
          type="button"
          className={classes("agent-icon", app.agent === agent.id && "active")}
          onClick={() => app.selectAgent(agent.id)}
          title={agent.label}
          disabled={app.busy}
          key={agent.id}
        >
          <img src={agent.image} alt={agent.label} />
        </button>
      ))}
    </div>
  );
}

function ModelPicker({ app }: AppProps) {
  return (
    <label className="model-picker" title="モデルID。空欄ならCLIのデフォルトを使います。">
      <span>モデル</span>
      <input
        type="text"
        value={app.model}
        onChange={(event) => app.model = event.target.value}
        onBlur={() => app.saveModel()}
        list={`model-options-${app.agent}`}
        disabled={app.busy}
        placeholder="デフォルト"
        autoComplete="off"
        spellCheck={false}
      />
      <datalist id={`model-options-${app.agent}`}>
        {app.modelOptions.map((option: { value: string; label: string }) => (
          <option value={option.value} label={option.label} key={option.value} />
        ))}
      </datalist>
    </label>
  );
}

function SendButton({ app }: AppProps) {
  const running = app.codingAgentRunning;
  const label = running ? "コーディングAIを停止" : "改善を依頼";
  return (
    <button
      className={classes("send-button", running && "stop-mode")}
      type={running ? "button" : "submit"}
      disabled={running ? app.stopping : app.busy || !app.idea.trim()}
      onClick={running ? () => app.cancelImprove() : undefined}
      aria-label={label}
      title={label}
    >
      {!running
        ? (
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m6 12 6-6 6 6" />
            <path d="M12 18V6" />
          </svg>
        )
        : (
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="7" y="7" width="10" height="10" rx="2" fill="currentColor" stroke="none" />
          </svg>
        )}
    </button>
  );
}

function Composer({ app }: AppProps) {
  return (
    <form
      className="composer"
      onSubmit={(event) => {
        event.preventDefault();
        app.improve();
      }}
    >
      <textarea
        value={app.idea}
        onChange={(event) => app.idea = event.target.value}
        placeholder="作戦のアイデアを入力…"
        disabled={app.busy}
        onCompositionStart={() => app.startComposition()}
        onCompositionEnd={() => app.endComposition()}
        onKeyDown={(event) => app.sendOnEnter(event)}
        onKeyUp={(event) => {
          if (event.key === "Enter") app.clearCompositionGuard();
        }}
      />
      <div className="composer-toolbar">
        <AgentPicker app={app} />
        <ModelPicker app={app} />
        <span className="composer-hint">Shift + Enterで改行</span>
        <SendButton app={app} />
      </div>
    </form>
  );
}

function ChatFeed({ app }: AppProps) {
  return (
    <div
      className="chat-feed"
      ref={(element) => {
        app.$refs.chatFeed = element;
      }}
      onScroll={() => app.updateChatScrollState()}
    >
      {app.messages.length === 0 && (
        <article className="welcome">
          <img src="/assets/app-icon.png" alt="" />
          <h2>どんな作戦にしますか？</h2>
          <p>アイデアを伝えると選択中のエージェントを改善します。</p>
        </article>
      )}
      {app.messagesBeforeCodingLogs.map((message: Message, index: number) => (
        <ChatMessage message={message} key={index} />
      ))}
      {app.displayedCodingLogs.map((log: CodingLogEntry) => (
        <div className="coding-log-entry" key={log.id}>
          <CodingLog app={app} log={log} />
        </div>
      ))}
      {app.codingAgentFinalMessage && <ChatMessage message={app.codingAgentFinalMessage} />}
    </div>
  );
}

function ViewerPanel({ app }: AppProps) {
  return (
    <section className="viewer-panel" hidden={!app.viewerOpen} aria-label="囲みマスの対戦画面">
      {app.viewerLoading && <div className="viewer-loading">対戦画面を読み込んでいます…</div>}
      <iframe
        className="viewer-frame"
        title="囲みマスの対戦画面"
        src={app.viewerOpen ? app.viewerUrl : "about:blank"}
        onLoad={() => app.viewerLoading = false}
        sandbox="allow-forms allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts"
        referrerPolicy="no-referrer"
        allow="fullscreen"
      />
    </section>
  );
}

export function ChatPane({ app }: AppProps) {
  return (
    <section className="chat-pane" hidden={!app.selected}>
      <header className="pane-header chat-header">
        <nav className="tab-list chat-view-tabs" aria-label="中央ペインを選択">
          <button
            type="button"
            className={classes("tab", !app.viewerOpen && "active")}
            onClick={() => app.closeViewer()}
          >
            チャット
          </button>
          <button
            type="button"
            className={classes("tab", app.viewerOpen && "active")}
            onClick={() => app.openViewer()}
            disabled={!app.viewerUrl}
          >
            対戦画面
          </button>
        </nav>
        <div className="chat-header-actions">
          {app.viewerOpen && (
            <a
              className="viewer-external-link"
              href={app.viewerUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              外部ブラウザで開く ↗
            </a>
          )}
          {!app.viewerOpen && (
            <button
              type="button"
              className="chat-clear-button"
              onClick={() => app.clearChat()}
              disabled={app.busy || app.messages.length === 0}
              title="このエージェントのチャット履歴をクリア"
            >
              チャットをクリア
            </button>
          )}
        </div>
      </header>
      <section className="strategy-panel" hidden={app.viewerOpen}>
        <ChatFeed app={app} />
        <Composer app={app} />
      </section>
      <ViewerPanel app={app} />
    </section>
  );
}
