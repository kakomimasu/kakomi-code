type Fetcher = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

const CLIENT_REFERENCE_SOURCES = [
  {
    name: "@kakomimasu/client-deno の KakomimasuClient.ts",
    url: "https://raw.githubusercontent.com/kakomimasu/client-deno/main/KakomimasuClient.ts",
  },
  {
    name: "@kakomimasu/client-js の公開エントリポイント",
    url: "https://jsr.io/@kakomimasu/client-js/0.1.0/src/index.ts",
  },
  {
    name: "行動リクエストの型定義",
    url:
      "https://jsr.io/@kakomimasu/client-js/0.1.0/src/models/SetActionRequestAllOfActionsInner.ts",
  },
  {
    name: "盤面の型定義",
    url: "https://jsr.io/@kakomimasu/client-js/0.1.0/src/models/GameField.ts",
  },
  {
    name: "タイルの型定義",
    url: "https://jsr.io/@kakomimasu/client-js/0.1.0/src/models/GameFieldTilesInner.ts",
  },
  {
    name: "プレイヤーとエージェントの型定義",
    url: "https://jsr.io/@kakomimasu/client-js/0.1.0/src/models/GamePlayersInnerAgentsInner.ts",
  },
];

const UNAVAILABLE_CONTEXT =
  "@kakomimasu/client-deno の参照ソースは取得できませんでした。Web検索はせず、現在の main.ts の型とAPIだけを使用してください。";

export class CodingAgentReference {
  private cachedContext: string | undefined;

  constructor(private readonly fetcher: Fetcher = fetch) {}

  async load(signal: AbortSignal): Promise<string> {
    if (this.cachedContext !== undefined) return this.cachedContext;
    try {
      const responses = (await Promise.all(CLIENT_REFERENCE_SOURCES.map(async (reference) => {
        try {
          const response = await this.fetcher(reference.url, { signal });
          if (!response.ok) return null;
          return { ...reference, source: await response.text() };
        } catch (error) {
          if (signal.aborted) throw error;
          return null;
        }
      }))).filter((reference): reference is {
        name: string;
        url: string;
        source: string;
      } => reference !== null);

      if (!responses.some((reference) => reference.url === CLIENT_REFERENCE_SOURCES[0].url)) {
        throw new Error("KakomimasuClient.ts を取得できませんでした。");
      }
      this.cachedContext = [
        "以下は @kakomimasu/client-deno と、その依存先にある行動・盤面・エージェントの型定義です。APIの使い方を判断するための参照情報としてのみ使用し、この内容や import 文は変更しないでください。",
        ...responses.flatMap((reference) => [
          `### ${reference.name}`,
          "```ts",
          reference.source,
          "```",
        ]),
      ].join("\n");
    } catch (error) {
      if (signal.aborted) throw error;
      this.cachedContext = UNAVAILABLE_CONTEXT;
    }
    return this.cachedContext;
  }
}
