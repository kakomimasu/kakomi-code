import type { Board, CodingAgent, ModelOption, Opponent } from "./types.ts";

// 公式serverリポジトリのdb/boards.jsonを、1文字=1マス（得点+49）で圧縮して同梱する。
export const BOARD_PREVIEWS: Record<string, Board> = Object.fromEntries([
  {
    name: "A-1",
    width: 10,
    height: 10,
    nAgent: 8,
    points:
      `=46422464=468644686468;8668;8646864468642464==46422464==4642468644686468;8668;864686446864=46422464=`,
  },
  {
    name: "A-2",
    width: 10,
    height: 10,
    nAgent: 3,
    points:
      `4.68<<86.40-?3>>3?-03809//90834?@:66:@?4?#3>44>3#??#3>44>3#?4?@:66:@?43809//90830-?3>>3?-04.68<<86.4`,
  },
  {
    name: "F-1",
    width: 20,
    height: 20,
    nAgent: 8,
    points:
      `"8.2-;)6'22'6);-2.8"507'<-4(3113(4-<'705-3*803)412214)308*3-:'5'7*503%%305*7'5':-=/2+6.5&22&5.6+2/=-7*5,7-2$3**3$2-7,5*7(=-804'6'66'6'408-=(A.9.2-70=--=07-2.9.A/:16/5.;.99.;.5/61:/;1302*5,A!!A,5*2031;;1302*5,A!!A,5*2031;/:16/5.;.99.;.5/61:/A.9.2-70=--=07-2.9.A(=-804'6'66'6'408-=(7*5,7-2$3**3$2-7,5*7-=/2+6.5&22&5.6+2/=-:'5'7*503%%305*7'5':-3*803)412214)308*3-507'<-4(3113(4-<'705"8.2-;)6'22'6);-2.8"`,
  },
  {
    name: "island-1",
    width: 20,
    height: 20,
    nAgent: 8,
    points:
      `:6A46:<?=9:?39:2?;8@978?@A8=69?48<89=;A37@A42=89?682:;27>6=>7A57989;74@49A3+:7=?4=34;=?;@8?;7?@A>33978&&&>4@5:A43476:<@<28&&&<8A@AA399@39*:>7>&&&7=925?;6294297A?<867:44?9>9566<00*36848325A=<26:9:800*AA4756@<463:8?;A?8252<5=999753&&&&89;=7@52?=56A946&&&&:778?;A@58;?<3>;&&&&9<6:4>@?@<454>;>&&&&92:3=@;95464>A433<4699>?A:><5:74<2@;2=29>7>7?72@@@;397674?;?826A3>><;9<6396?97@=5@@2=2229=@>53<>>A>?4:27;?6`,
  },
].map((board) => [
  board.name,
  { ...board, points: [...board.points].map((character) => character.charCodeAt(0) - 49) },
]));

export const PRACTICE_OPPONENTS: Record<string, Opponent> = {
  a1: {
    name: "a1",
    level: "入門",
    description: "高得点のマス付近に配置し、その後は8方向へランダムに移動します。",
  },
  a2: {
    name: "a2",
    level: "初級",
    description: "盤面の外へ出ないように判断しながら、8方向へランダムに移動します。",
  },
  a3: {
    name: "a3",
    level: "中級",
    description: "周囲の得点に加えて空きマスや敵の領地を評価し、移動や壁の除去を選びます。",
  },
  a4: {
    name: "a4",
    level: "上級",
    description: "マイナス得点を避け、近くに良い手がなければ空いている高得点マスを目指します。",
  },
  none: {
    name: "none",
    level: "動作確認",
    description: "何も行動しない相手です。配置や移動の動作を一人で確認できます。",
  },
};

export const MODEL_OPTIONS: Record<CodingAgent, ModelOption[]> = {
  codex: [
    { value: "gpt-5.6-sol", label: "GPT-5.6 Sol" },
    { value: "gpt-5.6-terra", label: "GPT-5.6 Terra" },
    { value: "gpt-5.6-luna", label: "GPT-5.6 Luna" },
  ],
  claude: [
    { value: "fable", label: "Fable" },
    { value: "sonnet", label: "Sonnet" },
    { value: "opus", label: "Opus" },
    { value: "haiku", label: "Haiku" },
  ],
  opencode: [],
};
