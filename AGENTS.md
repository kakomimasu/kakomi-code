# AGENTS.md

## プロジェクト概要

囲みコードは、囲みマス用AIを作成・改善・対戦させるDeno製デスクトップアプリです。
利用者がプログラミング初心者であることを前提に、表示文言と操作を分かりやすく保ってください。

## リポジトリ構成

- `desktop/`: デスクトップアプリ、ローカルAPI、画面
- `desktop/ui/`: React画面、用途別hooks、Zustandによる状態管理
- `desktop/shared/`: ブラウザとDenoで共有する型・定数
- `template/main.ts`: 新しいAIへコピーする初期コード
- `test/`: Denoのテスト
- `e2e/`: Chromiumで画面からローカルAPI・ファイル保存まで確認するE2Eテスト
- `scripts/`: 配布ファイルのビルドなど、開発・リリース用スクリプト
- `website/`: GitHub Pagesで公開する静的な紹介サイト
- `versions/`: 利用者が作ったAI。Gitへ追加しない
- `docs/architecture.md`: コンポーネントとデータフローの説明
- `SECURITY.md`: セキュリティ境界と報告方法

## 開発コマンド

- 全検証: `deno task verify`
- デスクトップの検証: `deno task verify:desktop`
- 紹介サイトの検証: `deno task verify:website`
- テスト: `deno task test`
- E2E用ブラウザの準備: `deno task e2e:install`
- E2Eテスト: `deno task test:e2e`（画面ビルドを含む）
- 型チェック: `deno task check`
- lint: `deno task lint`
- フォーマット確認: `deno task fmt:check`
- React画面のDenoバンドル: `deno task ui:build`
- アプリ起動: macOS / Linuxは `./run.sh`、Windowsは `run.bat`
- 配布ビルド: `deno task release:build --target <target> --output <file>`

素の `deno test` では必要な権限が付かないため、必ず `deno task test` を使ってください。
E2Eは通常のテスト・`verify` とは別に `deno task test:e2e` で実行します。CIでは両方を実行します。

## 実装上の不変条件

- `versions/` 内の利用者コードやローカルのLT資料を通常のコミットへ含めない。
- `template/main.ts` の公開APIと、初回起動時のコピー元としての役割を維持する。
- バージョンの読み書き・名前変更・削除では、`versions/` 直下の管理対象だけを許可する。
- ローカルAPIは `127.0.0.1`
  で待ち受け、ループバック、同一オリジン、起動ごとのAPIトークン検証を維持する。
- 対戦AIの子プロセスへ `-A` を渡さない。読み取り、通信先、環境変数の権限を必要最小限に保つ。
- コーディングAIへ編集を許可するのは、選択中のバージョンの `main.ts` だけにする。
- 外部プロセスの出力は上限を設け、メモリへ無制限に保持しない。
- `run.sh` はmacOS標準の古いBashでも動作させる。空配列の展開など、`set -u`
  と衝突する書き方を避ける。
- `dist/` はDenoで作るReact画面の生成物でGit管理しない。`desktop/index.html`、`desktop/ui.tsx`、
  または `desktop/ui/` を変更し、`deno task ui:build` で生成する。
- 配布版は同梱した `template/main.ts`
  をユーザー領域へ展開し、インストール先へ利用者データを書かない。
- Releaseワークフローでは、Denoのバージョンと対応OS・アーキテクチャを明示する。
- デスクトップ画面は内蔵Chromiumで動かすため、`deno.json` の `desktop.backend: "cef"` を維持する。
- チャット欄の内蔵ブラウザは、検証済みの囲みマス対戦URLだけをsandbox付きiframeの開始URLにする。

## 変更時の方針

- 既存の公開文言は初心者にも分かる日本語を優先する。
- 挙動を変えた場合は、同じ変更で回帰テストを追加または更新する。
- セキュリティ境界を変える場合は `SECURITY.md` と `docs/architecture.md` も確認する。
- websiteを変更する場合は `website/AGENTS.md` の追加ルールにも従う。
- 新しい本番依存を追加する前に、標準ライブラリや既存依存で実現できないか確認する。
- `desktop/shared/` はブラウザとDenoの両方で利用するため、Deno専用API、DOM、React、
  ファイル操作など実行環境に依存する処理を持ち込まない。
- ファイルを追加した場合は、`deno.json` の `check`、`lint`、`fmt:check`
  の対象に含まれることを確認する。

## チャット履歴を変更するとき

- メッセージの型と履歴の上限値は `desktop/shared/chat-history.ts`
  を参照する。画面側と保存側へ同じ定義を追加しない。
- `desktop/ui/chat-history.ts` は表示・保存する履歴を上限内へ整理し、`desktop/chat_history.ts`
  は受け取った履歴の検証とファイル保存を担当する。画面側で整理済みでも保存側の検証を省略しない。
- 画面内の履歴はバージョンのパス、保存する履歴はバージョンの名前をキーにする。 保存用の変換は
  `createChatHistoryPayload` に集約する。
- AI改善の成功・停止・失敗時の結果反映は `use-improvement.ts` の `recordResult`
  に集約する。履歴の上限処理、結果表示、保存を各分岐で重複させない。
- 改善結果の扱いを変える場合は、履歴の保存失敗時も結果が画面に残り、実行中の状態が解除されることを確認する。
- 関連テストは `test/chat_history_test.ts`、`test/ui_store_test.ts`、`test/ui_components_test.tsx`。
  上限の境界、画面から作った保存データの検証、改善の成功・停止・失敗と保存失敗を扱う。

## E2Eテストを変更するとき

- PlaywrightはLinuxでWSL判定用の `/proc` を参照するため、`e2e:install` と `test:e2e`
  の実行プロセスには `--allow-all` が必要。これは開発用E2Eの例外であり、対戦AIの権限へ適用しない。
- `e2e/fixture.ts` の一時フォルダーを使い、利用者の `versions/` やホーム内の設定を読み書きしない。
- ファイル操作は本番と同じ `desktop/workspace_api.ts` と `desktop/local_server.ts`
  を通す。トークン・Origin・管理対象パスの検証をテスト用に省略しない。
- 外部AI、対戦サービス、ネイティブウィンドウはこのE2Eの対象外。外部接続は失敗として扱う。
- 固定時間の待機より、表示文言や要素の状態を待つ。保存操作は一時フォルダー内のファイルも検証する。
- 失敗時の `e2e-results/` はGitへ追加しない。スクリーンショットとトレースで原因を確認する。
- Playwrightのバージョンを変更する場合は、`e2e/fixture.ts` と `deno.json` の `e2e:install`
  を合わせ、ブラウザを再インストールする。

## Code Review Rules

- ローカルAPIの許可ホスト、Origin、APIトークン検証を弱める変更を指摘する。
- 子プロセスのファイル、ネットワーク、環境変数、コマンド実行権限を広げる変更を指摘する。
- `versions/` 外のパスを読み書き・削除できる変更を指摘する。
- 外部プロセス出力やチャット履歴を無制限に保持する変更を指摘する。
- `run.sh` にBash 4以降だけの構文を導入する変更を指摘する。
