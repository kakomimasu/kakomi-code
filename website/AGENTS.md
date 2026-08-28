# Website instructions

このディレクトリは、Astroで構築してGitHub Pagesへ配置する静的な紹介サイトです。

## 実装ルール

- ページはAstroコンポーネントへ分割し、クライアントJavaScriptは必要最小限にする。
- スタイルはTailwind CSSのユーティリティクラスを優先する。
- 既存の日本語のトーン、グレー基調のヘッダーとフッター、囲みコードのブランド表現を維持する。
- モバイル幅でも横スクロール、文字切れ、操作不能が起きないようにする。
- 画像には内容が分かる `alt` を設定し、装飾だけの画像は空の `alt` を使う。
- キーボード操作、フォーカス表示、十分な色コントラストを維持する。
- 外部リンクのURL、コピー用コマンド、macOS / Linux / Windowsの案内を変更後に確認する。
- スクリーンショットを差し替える場合は、秘密情報、個人情報、不要なローカルパスが写っていないか確認する。

## 検証

- `deno task website:build`
- `deno task website:check`
- `deno fmt --check website/AGENTS.md website/astro.config.mjs website/package.json website/src`
- レイアウト変更時はデスクトップ幅とモバイル幅の両方をブラウザで確認する。
