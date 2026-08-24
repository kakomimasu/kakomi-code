# 囲みコード

囲みマスを始める人向けのAIスターターキット「囲みコード」です。

紹介ページは [GitHub Pages](https://ninja03.github.io/kakomi-code/) で公開しています。

囲みマスを始める人が、**アルゴリズムを書くことだけに集中して対戦へ参加する**ための Deno / TypeScript
製スターターキットです。

普段編集するのは、各 `versions/<バージョン名>/main.ts`
**だけ**です。公式DenoクライアントとユーティリティはURLから読み込むため、APIの呼び出し方を最初に覚える必要はありません。

## このキットでできること

- Deno を入れるだけで、追加のパッケージ管理をせずに始められる
- まずは同梱のサンプル戦略で参加し、少しずつ `decide` を書き換えられる
- ゲストとしてフリー対戦へ参加できる
- 公式の何もしない AI と対戦して、戦略を安全に試せる
- Desktop上でバージョン作成、Codex / Claude Codeによる改善、対戦ができる

## 最短で参加する

1. [Deno](https://docs.deno.com/runtime/getting_started/installation/) をインストールする。
2. このフォルダをダウンロード／clone する。
3. macOS / Linux では `run.sh`、Windows では `run.bat` を実行してデスクトップアプリを起動する。

```sh
./run.sh
```

これだけでバージョン管理付きのダッシュボードが開きます。画面用の JavaScript やアイコンは
プロジェクトに同梱されているため、別途フロントエンドのビルド操作は必要ありません。

VSCodeでは、`Cmd/Ctrl + Shift + B` または「タスクの実行」から「囲みコードを起動」を選ぶと起動できます。
どちらのスクリプトも、Denoが入っていればDesktopアプリを作成して起動します。

表示された「囲みコード」の画面で
AI（エージェント）名、使用するバージョン、練習相手、盤面を選んで「対戦を始める」を押します。参加後は対戦画面へのリンクが表示され、対戦中の出力で進行を確認できます。設定はホームディレクトリ内の
`.kakomimasu-ai-starter/` に保存されます。

## Desktopアプリから Codex / Claude Code に作戦改善を依頼する

最初に「新しいバージョンを作る」を押すと、直前のバージョンをコピーした新しいディレクトリが
`versions/` にできます。次にコーディングAIを選び、日本語の作戦メモを入力します。Codex / Claude
Codeは、選択したバージョンを作業ディレクトリとして起動し、`main.ts` だけを編集します。

改善依頼欄の「モデル」にモデルIDを入力すると、そのモデルで実行できます。Codexでは
`gpt-5.6-sol`、`gpt-5.6-terra`、`gpt-5.6-luna`、Claude Codeでは `fable`、`sonnet`、`opus`、
`haiku` が候補として表示されます。初期値はCodexが `gpt-5.6-luna`、Claude Codeが `haiku` です。
空欄にすると各CLIのデフォルトモデルを使います。選択したモデルはCodexとClaude Codeごとにローカル保存されます。

使用するPCでは、Codex CLIまたはClaude
Codeをインストールしてログイン済みにしてください。作成したバージョンはローカルに保存され、Gitでは追跡されません。

## 改良版をフォルダとして残す

Desktopの「＋」では、Git管理された `template/main.ts` をベースに新しい版を作成し、「複」で選択中の版をコピーします。各版は `main.ts`
だけを持ちます。`versions/エルメマス1号/main.ts` を編集しても、以後「＋」で作成する版の初期ソースは変わりません。エルメマス1号も通常の版として名前変更・削除できます。作成した版はローカルに残ります。必要なら、作成した版を別途バックアップしてください。

通信・マッチング・ターン進行は、公式 [client-deno](https://github.com/kakomimasu/client-deno) の
`KakomimasuClient.ts` と `client_util.ts`
をURLから読み込みます。Desktopアプリから開始する対戦は、公式AIとの練習モードです。

## 対戦方法

対戦タブで公式AIと盤面を選びます。初めて戦略を変更するときは、まず `none` または `a1`
との練習をおすすめします。

## 戦略を書く

`main.ts` の `client.onturn` は毎ターン呼ばれ、行動の配列を返します。最初は何も行動しない
シンプルなテンプレートです。`actions` に行動を追加して作戦を作っていきます。

```ts
client.onturn = () => {
  const actions: ActionPost[] = [];
  actions.push({ agentId: 0, type: "MOVE", x: 3, y: 2 });
  return actions;
};
```

- `PUT`: 未配置のエージェントを置く
- `MOVE`: 隣接8方向のマスへ移動する
- `REMOVE`: 隣接する相手の壁を壊す
- 盤面は `field[y][x]`。`type` は `0=タイル / 1=壁`、`owner` は未所有時 `null`。

行動を返さないエージェントはパスします。同じエージェントへ複数行動を返した場合は送信前にエラーになります。

## 開発用コマンド

```sh
deno task check  # TypeScript の型チェック
deno lint        # ソースコードの lint
deno task test   # テスト
```

まとめて確認する場合は、次を実行します。

```sh
deno task check && deno lint && deno task test
```

## 参照

- [囲みマス](https://kakomimasu.com/)
- [公式 Deno クライアント](https://github.com/kakomimasu/client-deno)
- [公式 JavaScript API クライアント](https://github.com/kakomimasu/client-js)

このスターターは、公式クライアントの API v1 の利用方法に合わせて作っています。
