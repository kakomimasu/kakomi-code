import { Field } from "@base-ui/react/field";
import { Tabs } from "@base-ui/react/tabs";
import { ToggleGroup } from "@base-ui/react/toggle-group";
import { classes } from "./common.tsx";
import {
  appIconUrl,
  claudeIconUrl,
  codexIconUrl,
  opencodeDarkIconUrl,
  opencodeLightIconUrl,
} from "./assets.ts";
import { ModelPicker } from "./model-picker.tsx";
import { Button, TooltipButton, TooltipToggleButton } from "./primitives.tsx";
import type { AppProps, CodingLogEntry, Message } from "./types.ts";

const AGENTS = [
  { id: "codex", label: "Codex", image: codexIconUrl },
  { id: "claude", label: "Claude Code", image: claudeIconUrl },
  {
    id: "opencode",
    label: "OpenCode",
    image: opencodeLightIconUrl,
    darkImage: opencodeDarkIconUrl,
  },
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
    <ToggleGroup
      className="agent-picker"
      aria-label="コーディングAIを選択"
      value={[app.agent]}
      disabled={app.busy}
      onValueChange={(agents) => {
        const agent = agents[0];
        if (agent) app.selectAgent(agent);
      }}
    >
      {AGENTS.map((agent) => (
        <TooltipToggleButton
          value={agent.id}
          className={(state) => classes("agent-icon", state.pressed && "active")}
          label={agent.label}
          disabled={app.busy}
          key={agent.id}
        >
          {"darkImage" in agent
            ? (
              <picture>
                <source media="(prefers-color-scheme: dark)" srcSet={agent.darkImage} />
                <img src={agent.image} alt={agent.label} />
              </picture>
            )
            : <img src={agent.image} alt={agent.label} />}
        </TooltipToggleButton>
      ))}
    </ToggleGroup>
  );
}

function SendButton({ app }: AppProps) {
  const running = app.codingAgentRunning;
  const label = running ? "コーディングAIを停止" : "改善を依頼";
  return (
    <TooltipButton
      className={classes("send-button", running && "stop-mode")}
      type={running ? "button" : "submit"}
      disabled={running ? app.stopping : app.busy || !app.idea.trim()}
      onClick={running ? () => app.cancelImprove() : undefined}
      label={label}
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
    </TooltipButton>
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
      <Field.Root className="contents" disabled={app.busy}>
        <Field.Label className="sr-only">作戦のアイデア</Field.Label>
        <Field.Control
          render={
            <textarea
              value={app.idea}
              onChange={(event) => app.setIdea(event.target.value)}
              placeholder="作戦のアイデアを入力…"
              onCompositionStart={() => app.startComposition()}
              onCompositionEnd={() => app.endComposition()}
              onKeyDown={(event) => app.sendOnEnter(event)}
              onKeyUp={(event) => {
                if (event.key === "Enter") app.clearCompositionGuard();
              }}
            />
          }
        />
        <Field.Description className="sr-only">
          Enterで送信します。ShiftとEnterを同時に押すと改行します。
        </Field.Description>
      </Field.Root>
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
      ref={app.chatFeedRef}
      role="log"
      aria-label="チャット履歴"
      aria-live="polite"
      aria-relevant="additions"
      onScroll={() => app.updateChatScrollState()}
    >
      {app.messages.length === 0 && (
        <article className="mx-0 my-auto w-[min(440px,90%)] self-center px-6 py-8 text-center">
          <img
            className="mb-3.5 h-12 w-12 rounded-[13px] shadow-[0_5px_18px_#00000016] dark:shadow-[0_4px_16px_#00000055]"
            src={appIconUrl}
            alt=""
          />
          <h2 className="m-0 text-[24px] font-[680] tracking-[-0.025em] text-[#292927] dark:text-[#efefeb]">
            どんな作戦にしますか？
          </h2>
          <p className="mx-auto mt-[9px] mb-0 text-[14px] leading-[1.65] text-[#858580] dark:text-[#b9b9b2]">
            アイデアを伝えると選択中のエージェントを改善します。
          </p>
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
    <Tabs.Panel
      className="viewer-panel"
      value="viewer"
      keepMounted
      aria-label="囲みマスの対戦画面"
    >
      {app.viewerLoading && (
        <div className="absolute inset-0 z-[1] grid place-items-center bg-[#fbfbfa] text-[13px] text-[#777773] dark:bg-[#1b1b1a] dark:text-[#b3b3ac]">
          対戦画面を読み込んでいます…
        </div>
      )}
      <iframe
        className="block h-full w-full border-0 bg-white"
        title="囲みマスの対戦画面"
        src={app.viewerOpen ? app.viewerUrl : "about:blank"}
        onLoad={() => app.setViewerLoading(false)}
        sandbox="allow-forms allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts"
        referrerPolicy="no-referrer"
        allow="fullscreen"
      />
    </Tabs.Panel>
  );
}

export function ChatPane({ app }: AppProps) {
  return (
    <Tabs.Root
      className="chat-pane"
      id="chat-pane"
      hidden={!app.selected}
      value={app.viewerOpen ? "viewer" : "chat"}
      onValueChange={(value) => value === "viewer" ? app.openViewer() : app.closeViewer()}
    >
      <header className="pane-header chat-header">
        <Tabs.List
          className="tab-list chat-view-tabs"
          aria-label="中央ペインを選択"
          activateOnFocus
        >
          <Tabs.Tab
            className={(state) => classes("tab", state.active && "active")}
            value="chat"
          >
            チャット
          </Tabs.Tab>
          <Tabs.Tab
            className={(state) => classes("tab", state.active && "active")}
            value="viewer"
            disabled={!app.viewerUrl}
          >
            対戦画面
          </Tabs.Tab>
        </Tabs.List>
        <div className="flex items-center gap-2">
          {app.viewerOpen && (
            <a
              className="text-[11px] text-[#777773] no-underline hover:text-[var(--accent)] dark:text-[#b3b3ac]"
              href={app.viewerUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              外部ブラウザで開く ↗
            </a>
          )}
          {!app.viewerOpen && (
            <Button
              type="button"
              variant="subtleDanger"
              size="sm"
              onClick={() => app.clearChat()}
              disabled={app.busy || app.messages.length === 0}
              title="このエージェントのチャット履歴をクリア"
            >
              チャットをクリア
            </Button>
          )}
        </div>
      </header>
      <Tabs.Panel className="strategy-panel" value="chat" keepMounted>
        <ChatFeed app={app} />
        <Composer app={app} />
      </Tabs.Panel>
      <ViewerPanel app={app} />
    </Tabs.Root>
  );
}
