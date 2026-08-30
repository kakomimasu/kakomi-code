import { type FormEvent, useCallback, useEffect, useId, useRef, useState } from "react";
import { Button } from "./primitives.tsx";

type TextDialogOptions = {
  title: string;
  description: string;
  initialValue?: string;
  confirmLabel: string;
};
type ConfirmDialogOptions = {
  title: string;
  description: string;
  confirmLabel: string;
  danger?: boolean;
};
type DialogRequest =
  | ({ kind: "text" } & TextDialogOptions)
  | ({ kind: "confirm" } & ConfirmDialogOptions);
type DialogResult = string | boolean | null;

export type DialogActions = {
  requestText(options: TextDialogOptions): Promise<string | null>;
  requestConfirmation(options: ConfirmDialogOptions): Promise<boolean>;
};

export function useDialogController() {
  const [request, setRequest] = useState<DialogRequest | null>(null);
  const resolverRef = useRef<((value: DialogResult) => void) | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  const finish = useCallback((value: DialogResult) => {
    resolverRef.current?.(value);
    resolverRef.current = null;
    setRequest(null);
    const returnFocus = returnFocusRef.current;
    returnFocusRef.current = null;
    queueMicrotask(() => returnFocus?.focus());
  }, []);

  const rememberFocus = () => {
    returnFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
  };

  const requestText = useCallback((options: TextDialogOptions) => {
    resolverRef.current?.(null);
    rememberFocus();
    setRequest({ kind: "text", ...options });
    return new Promise<string | null>((resolve) => {
      resolverRef.current = (value) => resolve(typeof value === "string" ? value : null);
    });
  }, []);

  const requestConfirmation = useCallback((options: ConfirmDialogOptions) => {
    resolverRef.current?.(false);
    rememberFocus();
    setRequest({ kind: "confirm", ...options });
    return new Promise<boolean>((resolve) => {
      resolverRef.current = (value) => resolve(value === true);
    });
  }, []);

  return { request, requestText, requestConfirmation, finish };
}

type DialogController = ReturnType<typeof useDialogController>;

export function AppDialog({ controller }: { controller: DialogController }) {
  const { request, finish } = controller;
  const inputRef = useRef<HTMLInputElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!request) return;
    queueMicrotask(() => (request.kind === "text" ? inputRef.current : cancelRef.current)?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        finish(request.kind === "confirm" ? false : null);
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(
        popupRef.current?.querySelectorAll<HTMLElement>(
          "button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href]",
        ) ?? [],
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [request, finish]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!request) return;
    if (request.kind === "text") {
      const value = inputRef.current?.value.trim() || "";
      if (value) finish(value);
      return;
    }
    finish(true);
  }

  if (!request) return null;
  const cancelValue = request.kind === "confirm" ? false : null;

  return (
    <div className="dialog-layer">
      <button
        type="button"
        className="dialog-backdrop"
        tabIndex={-1}
        aria-label="ダイアログを閉じる"
        onClick={() => finish(cancelValue)}
      />
      <div className="dialog-viewport">
        <section
          ref={popupRef}
          className="dialog-popup"
          role={request.kind === "confirm" ? "alertdialog" : "dialog"}
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={descriptionId}
        >
          <form onSubmit={submit}>
            <h2 id={titleId}>{request.title}</h2>
            <p id={descriptionId}>{request.description}</p>
            {request.kind === "text" && (
              <label className="dialog-field">
                名前
                <input
                  ref={inputRef}
                  name="agent-name"
                  type="text"
                  required
                  defaultValue={request.initialValue || ""}
                  autoComplete="off"
                />
              </label>
            )}
            <div className="dialog-actions">
              <Button
                ref={cancelRef}
                type="button"
                variant="secondary"
                onClick={() => finish(cancelValue)}
              >
                キャンセル
              </Button>
              <Button
                type="submit"
                variant={request.kind === "confirm" && request.danger ? "danger" : "primary"}
              >
                {request.confirmLabel}
              </Button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
