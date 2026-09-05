# コントリビューションガイド

囲みコードへの改善提案を歓迎します。変更は小さく分け、利用者に見える挙動を変える場合はテストと説明も同じ変更へ含めてください。

## 開発環境

必要なもの:

- Deno 2.9以降
- Git
- デスクトップアプリの改善依頼を確認する場合はCodex CLI、Claude Code CLI、OpenCodeのいずれか

Node.jsやnpmコマンドは不要です。ReactなどのnpmパッケージはDenoが自身のキャッシュで解決し、
`node_modules/` は作りません。

セットアップ:

```sh
git clone https://github.com/kakomimasu/kakomi-code.git
cd kakomi-code
```

接続先などを変更する場合だけ `.env` を作成してください。認証トークンをコミットしないでください。

React画面の依存関係はDenoが準備します。画面の生成だけを確認する場合は `deno task ui:build`
を実行してください。

## 起動

macOS / Linux:

```sh
./run.sh
```

Windows:

```bat
run.bat
```

Deno Desktopを直接確認する場合は、次のコマンドを実行します。React画面のバンドルと既存の
バックエンドをまとめて起動します。

```sh
deno task desktop
```

## 検証

変更を提出する前に、次の一括コマンドを実行してください。

```sh
deno task verify
```

個別に実行する場合:

```sh
deno task fmt:check
deno task lint
deno task check
deno task ui:build
deno task test
```

テストにはファイル、環境変数、Bash実行の権限が必要です。素の `deno test` ではなく `deno task test`
を使ってください。

## 変更別の確認

画面とローカルAPIをまたぐ変更は、通常の検証に加えてE2Eテストを実行してください。
初回はPlaywright用のChromiumを準備します。Node.jsやnpmコマンドは不要です。

```sh
deno task e2e:install
deno task test:e2e
```

Linuxでブラウザ用のシステムライブラリも必要な場合は、`deno task e2e:install --with-deps`
を実行します。システムライブラリのインストールには管理者権限が必要になる場合があります。

E2Eはビルド済みのReact画面とMonacoをChromiumで開き、本番と同じローカルAPIを通して、
エージェントの作成・コード保存・複製・名前変更・削除、チャット履歴の保持・クリア、APIの拒否条件を確認します。
データはテストごとの一時フォルダーへ保存し、終了時に削除します。外部AI・対戦サービスへの接続や
CEFのネイティブウィンドウ操作は対象外です。

E2Eは `deno task verify` に含めず、CIで追加実行します。失敗時は `e2e-results/`
にスクリーンショット・操作トレース・ブラウザエラーを出力し、CIではartifactとして7日間保持します。
トレースはPlaywrightのTrace Viewerで開けます。

| 変更               | 追加の確認                                           |
| ------------------ | ---------------------------------------------------- |
| `desktop/`         | `deno task ui:build`、関連するDenoテストと型チェック |
| `run.sh`           | `bash -n run.sh` と `test/run_script_test.ts`        |
| `run.bat`          | Windowsでの起動確認                                  |
| `template/main.ts` | `deno check template/main.ts` と初期AIの動作         |
| `website/`         | デスクトップ幅・モバイル幅、リンク、キーボード操作   |
| セキュリティ境界   | 回帰テスト、`SECURITY.md`、`docs/architecture.md`    |

## リリース

ローカルで配布ファイルを試作する場合は、対象と出力形式を指定します。

```sh
deno task release:build \
  --target aarch64-apple-darwin \
  --output dist/KakomiCode-test-macos-arm64.dmg
```

対応するターゲットと形式は次のとおりです。

| ターゲット                 | 形式        |
| -------------------------- | ----------- |
| `aarch64-apple-darwin`     | `.dmg`      |
| `x86_64-apple-darwin`      | `.dmg`      |
| `x86_64-pc-windows-msvc`   | `.msi`      |
| `x86_64-unknown-linux-gnu` | `.AppImage` |

`v` で始まるタグ（例:
`v0.1.0`）をGitHubへpushすると、`Release`ワークフローが全OS向けのファイルをビルドし、
同じタグのGitHub
Releaseへ添付します。現在はコード署名を行わないため、公開前に各OSで起動確認してください。

デスクトップアプリは `deno.json` の `desktop.backend` で `cef` を指定し、Chromiumを同梱します。
初回ビルドでは数百MBのCEFアーカイブを取得するため、十分な空き容量と通信環境を用意してください。

## コーディング方針

- Deno標準APIと既存依存を優先し、本番依存を不用意に増やさないでください。
- Denoのフォーマッターに従ってください。
- エラーメッセージと画面文言は、初心者にも分かる簡潔な日本語にしてください。
- 新しい分岐や境界条件には回帰テストを追加してください。
- セキュリティのための入力検証や権限制限を回避しないでください。

## ローカルデータ

次のデータはコミットしないでください。

- `.env`
- `versions/` 内の利用者AI
- ビルド済みアプリ
- 個人用のスクリーンショット、ログ、発表資料

作業ツリーに既存の未追跡ファイルがある場合は、自分の変更と混ぜず、コミット対象を明示的に選んでください。

## プルリクエスト

- 変更理由と利用者への影響を説明してください。
- 実行した検証コマンドと結果を記載してください。
- UI変更には、可能なら変更前後のスクリーンショットを添えてください。
- セキュリティ問題は公開のIssueへ詳細を書かず、`SECURITY.md` の方法で報告してください。
