import { Field } from "@base-ui/react/field";
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
    <Field.Root
      className="model-picker"
      disabled={app.busy}
      title="モデルID。空欄ならCLIのデフォルトを使います。"
    >
      <Field.Label>モデル</Field.Label>
      {app.modelOptions.length > 0
        ? (
          <Field.Control
            render={
              <select
                value={app.model}
                onChange={(event) => app.setModel(event.currentTarget.value)}
                onBlur={() => app.saveModel()}
                aria-label={`${agentLabel}のモデル`}
              >
                <option value="">デフォルト</option>
                {unknownModel && <option value={unknownModel}>{unknownModel}</option>}
                {app.modelOptions.map((option) => (
                  <option value={option.value} key={option.value}>{option.label}</option>
                ))}
              </select>
            }
          />
        )
        : (
          <>
            <Field.Control
              type="text"
              value={app.model}
              onValueChange={(value) => app.setModel(value)}
              onBlur={() => app.saveModel()}
              list={`model-options-${app.agent}`}
              placeholder="デフォルト"
              autoComplete="off"
              spellCheck={false}
            />
            <datalist id={`model-options-${app.agent}`}>
              {app.modelOptions.map((option) => (
                <option value={option.value} label={option.label} key={option.value} />
              ))}
            </datalist>
          </>
        )}
      <Field.Description className="sr-only">
        モデルIDを指定します。空欄ならコーディングAIのデフォルトを使います。
      </Field.Description>
    </Field.Root>
  );
}
