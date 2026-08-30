import type { KakomiApp } from "./types.ts";

type ModelPickerProps = Pick<
  KakomiApp,
  "agent" | "busy" | "model" | "modelOptions" | "saveModel" | "setModel"
>;

export function ModelPicker({ app }: { app: ModelPickerProps }) {
  const agentLabel = {
    codex: "Codex",
    claude: "Claude Code",
    opencode: "OpenCode",
  }[app.agent];
  const unknownModel = app.model && !app.modelOptions.some((option) => option.value === app.model)
    ? app.model
    : "";

  return (
    <label className="model-picker" title="モデルID。空欄ならCLIのデフォルトを使います。">
      <span>モデル</span>
      {app.modelOptions.length > 0
        ? (
          <select
            value={app.model}
            onChange={(event) => app.setModel(event.currentTarget.value)}
            onBlur={() => app.saveModel()}
            aria-label={`${agentLabel}のモデル`}
            disabled={app.busy}
          >
            <option value="">デフォルト</option>
            {unknownModel && <option value={unknownModel}>{unknownModel}</option>}
            {app.modelOptions.map((option) => (
              <option value={option.value} key={option.value}>{option.label}</option>
            ))}
          </select>
        )
        : (
          <>
            <input
              type="text"
              value={app.model}
              onChange={(event) => app.setModel(event.currentTarget.value)}
              onBlur={() => app.saveModel()}
              list={`model-options-${app.agent}`}
              placeholder="デフォルト"
              autoComplete="off"
              spellCheck={false}
              disabled={app.busy}
            />
            <datalist id={`model-options-${app.agent}`}>
              {app.modelOptions.map((option) => (
                <option value={option.value} label={option.label} key={option.value} />
              ))}
            </datalist>
          </>
        )}
      <span className="sr-only">
        モデルIDを指定します。空欄ならコーディングAIのデフォルトを使います。
      </span>
    </label>
  );
}
