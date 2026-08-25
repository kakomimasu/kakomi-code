# コントリビューションガイド

囲みコードへの改善提案を歓迎します。変更は小さく分け、利用者に見える挙動を変える場合はテストと説明も同じ変更へ含めてください。

## 開発環境

必要なもの:

- Deno 2系
- Git
- デスクトップアプリを確認する場合はCodex CLIまたはClaude Code CLI

セットアップ:

```sh
git clone https://github.com/kakomimasu/kakomi-code.git
cd kakomi-code
cp .env.example .env
```

`.env` は必要な場合だけ編集してください。認証トークンをコミットしないでください。

## 起動

macOS / Linux:

```sh
./run.sh
```

Windows:

```bat
run.bat
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
deno task test
```

テストにはファイル、環境変数、Bash実行の権限が必要です。素の `deno test` ではなく `deno task test`
を使ってください。

## 変更別の確認

| 変更               | 追加の確認                                         |
| ------------------ | -------------------------------------------------- |
| `desktop/`         | 関連するDenoテストと型チェック                     |
| `run.sh`           | `bash -n run.sh` と `test/run_script_test.ts`      |
| `run.bat`          | Windowsでの起動確認                                |
| `template/main.ts` | `deno check template/main.ts` と初期AIの動作       |
| `website/`         | デスクトップ幅・モバイル幅、リンク、キーボード操作 |
| セキュリティ境界   | 回帰テスト、`SECURITY.md`、`docs/architecture.md`  |

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
