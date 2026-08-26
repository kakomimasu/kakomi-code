# AGENTS.md

## プロジェクト概要

囲みコードは、囲みマス用AIを作成・改善・対戦させるDeno製デスクトップアプリです。
利用者がプログラミング初心者であることを前提に、表示文言と操作を分かりやすく保ってください。

## リポジトリ構成

- `desktop/`: デスクトップアプリ、ローカルAPI、画面
- `template/main.ts`: 新しいAIへコピーする初期コード
- `test/`: Denoのテスト
- `scripts/`: 配布ファイルのビルドなど、開発・リリース用スクリプト
- `website/`: GitHub Pagesで公開する静的な紹介サイト
- `versions/`: 利用者が作ったAI。Gitへ追加しない
- `docs/architecture.md`: コンポーネントとデータフローの説明
- `SECURITY.md`: セキュリティ境界と報告方法

## 開発コマンド

- 全検証: `deno task verify`
- テスト: `deno task test`
- 型チェック: `deno task check`
- lint: `deno task lint`
- フォーマット確認: `deno task fmt:check`
- アプリ起動: macOS / Linuxは `./run.sh`、Windowsは `run.bat`
- 配布ビルド: `deno task release:build --target <target> --output <file>`

素の `deno test` では必要な権限が付かないため、必ず `deno task test` を使ってください。

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
- `desktop/alpine.js` は同梱済み依存物のため、依存更新以外では編集しない。
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

## Code Review Rules

- ローカルAPIの許可ホスト、Origin、APIトークン検証を弱める変更を指摘する。
- 子プロセスのファイル、ネットワーク、環境変数、コマンド実行権限を広げる変更を指摘する。
- `versions/` 外のパスを読み書き・削除できる変更を指摘する。
- 外部プロセス出力やチャット履歴を無制限に保持する変更を指摘する。
- `run.sh` にBash 4以降だけの構文を導入する変更を指摘する。
