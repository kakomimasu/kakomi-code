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
      <main className="error-screen">
        <section
          className="error-card"
          role="alert"
          aria-live="assertive"
        >
          <p className="error-label">画面のエラー</p>
          <h1>画面を表示できませんでした</h1>
          <p className="error-description">
            画面を再読み込みしてください。作成済みのエージェントはそのままですが、入力途中の作戦は失われる場合があります。
          </p>
          <details className="error-details">
            <summary>詳しい情報</summary>
            <pre>
              {this.state.error}
            </pre>
          </details>
          <Button type="button" className="error-reload" onClick={this.reload}>
            画面を再読み込み
          </Button>
        </section>
      </main>
    );
  }
}
