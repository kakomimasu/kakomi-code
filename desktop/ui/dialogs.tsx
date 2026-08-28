import { AlertDialog } from "@base-ui/react/alert-dialog";
import { Dialog } from "@base-ui/react/dialog";
import { type FormEvent, useCallback, useRef, useState } from "react";
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

  const finish = useCallback((value: DialogResult) => {
    resolverRef.current?.(value);
    resolverRef.current = null;
    setRequest(null);
  }, []);

  const requestText = useCallback((options: TextDialogOptions) => {
    resolverRef.current?.(null);
    setRequest({ kind: "text", ...options });
    return new Promise<string | null>((resolve) => {
      resolverRef.current = (value) => resolve(typeof value === "string" ? value : null);
    });
  }, []);

  const requestConfirmation = useCallback((options: ConfirmDialogOptions) => {
    resolverRef.current?.(false);
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

  const content = (
    <Dialog.Portal>
      <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] transition-opacity duration-150 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
      <Dialog.Viewport className="fixed inset-0 z-50 grid place-items-center overflow-y-auto p-5">
        <Dialog.Popup
          className="w-full max-w-[420px] rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-5 text-current shadow-2xl transition-[opacity,transform] duration-150 data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0"
          initialFocus={request.kind === "text" ? inputRef : true}
        >
          <form onSubmit={submit}>
            <Dialog.Title className="m-0 text-base font-bold text-current">
              {request.title}
            </Dialog.Title>
            <Dialog.Description className="mt-2 mb-0 text-sm leading-6 text-[var(--muted)]">
              {request.description}
            </Dialog.Description>
            {request.kind === "text" && (
              <label className="mt-4 block text-sm font-semibold text-current">
                名前
                <input
                  ref={inputRef}
                  name="agent-name"
                  type="text"
                  required
                  defaultValue={request.initialValue || ""}
                  autoComplete="off"
                  className="mt-2 block w-full rounded-lg border border-[var(--line)] bg-transparent px-3 py-2 text-sm text-current outline-none transition-shadow focus:border-[var(--accent)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--accent)_25%,transparent)]"
                />
              </label>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <Dialog.Close
                render={
                  <Button type="button" variant="secondary">
                    キャンセル
                  </Button>
                }
              />
              <Button
                type="submit"
                variant={request.kind === "confirm" && request.danger ? "danger" : "primary"}
              >
                {request.confirmLabel}
              </Button>
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Viewport>
    </Dialog.Portal>
  );

  const handleClose = (open: boolean) => {
    if (!open) finish(request.kind === "confirm" ? false : null);
  };

  return request.kind === "confirm"
    ? <AlertDialog.Root open onOpenChange={handleClose}>{content}</AlertDialog.Root>
    : <Dialog.Root open onOpenChange={handleClose}>{content}</Dialog.Root>;
}
