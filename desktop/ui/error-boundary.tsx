import { Component, type ReactNode } from "react";
import { errorMessage } from "./hooks/helpers.ts";
import { Button } from "./primitives.tsx";

type AppErrorBoundaryProps = {
  children: ReactNode;
  onReload?: () => void;
};

type AppErrorBoundaryState = {
  error: string | null;
};

export class AppErrorBoundary extends Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  override state: AppErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: unknown): AppErrorBoundaryState {
    return { error: errorMessage(error) };
  }

  private reload = () => {
    if (this.props.onReload) {
      this.props.onReload();
      return;
    }
    globalThis.location.reload();
  };

  override render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="grid min-h-full place-items-center bg-[var(--panel)] p-6 text-current">
        <section
          className="w-full max-w-lg rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-6 shadow-xl"
          role="alert"
          aria-live="assertive"
        >
          <p className="m-0 text-sm font-bold text-[#b73b31] dark:text-[#ff9a8f]">
            画面のエラー
          </p>
          <h1 className="mt-2 mb-0 text-xl font-bold">画面を表示できませんでした</h1>
          <p className="mt-3 mb-0 text-sm leading-6 text-[var(--muted)]">
            画面を再読み込みしてください。作成済みのエージェントはそのままですが、入力途中の作戦は失われる場合があります。
          </p>
          <details className="mt-4 rounded-lg border border-[var(--line)] px-3 py-2 text-sm">
            <summary className="cursor-pointer font-semibold">詳しい情報</summary>
            <pre className="mt-2 mb-0 overflow-auto whitespace-pre-wrap text-xs text-[var(--muted)]">
              {this.state.error}
            </pre>
          </details>
          <Button type="button" className="mt-5" onClick={this.reload}>
            画面を再読み込み
          </Button>
        </section>
      </main>
    );
  }
}
