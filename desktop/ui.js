const apiToken = document.querySelector('meta[name="kakomi-api-token"]')?.content || "";

async function call(name, args = []) {
  const response = await fetch("/api/bindings/" + encodeURIComponent(name), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-kakomi-api-token": apiToken,
    },
    body: JSON.stringify({ args }),
  });
  const text = await response.text();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error("Desktopアプリとの接続に失敗しました。アプリを再起動してください。");
  }
  if (!response.ok) throw new Error(payload.error || name + "に失敗しました。");
  return payload.result;
}

// 公式 server リポジトリの db/boards.json を、1文字=1マス（得点+49）で圧縮して同梱する。
const BOARD_PREVIEWS = Object.fromEntries([
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

const PRACTICE_OPPONENTS = {
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

let sourceEditor;
let sourceEditorReady;
let sourceEditorResizeObserver;
let colorSchemeMediaQuery;
let colorSchemeListener;
const MODEL_OPTIONS = {
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
};
const SAVED_AGENT_KEY = "kakomimasu-agent";
const SAVED_MODELS_KEY = "kakomimasu-models";

function savedAgent() {
  const value = localStorage.getItem(SAVED_AGENT_KEY);
  return value === "claude" ? value : "codex";
}

function savedModels() {
  const defaults = { codex: "gpt-5.6-luna", claude: "haiku" };
  try {
    const parsed = JSON.parse(localStorage.getItem(SAVED_MODELS_KEY) || "{}");
    for (const agent of Object.keys(defaults)) {
      const value = parsed?.[agent];
      if (typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(value)) {
        defaults[agent] = value;
      }
    }
  } catch {
    // 壊れた保存値はデフォルトに戻す。
  }
  return defaults;
}

globalThis.kakomiApp = () => ({
  dashboard: { projectDir: "", versions: [] },
  selected: "",
  tab: "source",
  agent: savedAgent(),
  models: savedModels(),
  messagesByVersion: {},
  codingLogs: [],
  codingAgentResult: null,
  matchLogs: [],
  source: "",
  sourceStatus: "",
  completedFileChangeLogIds: new Set(),
  sourceReloadingAfterFileChange: false,
  sourceReloadPendingAfterFileChange: false,
  idea: "",
  status: "",
  matchStatus: "",
  matchRunning: false,
  viewerUrl: "",
  viewerOpen: false,
  viewerLoading: false,
  viewerStates: {},
  matchVersion: "",
  ai: "a1",
  board: "A-1",
  darkMode: typeof globalThis.matchMedia === "function" &&
    globalThis.matchMedia("(prefers-color-scheme: dark)").matches,
  busy: false,
  codingAgentRunning: false,
  stopping: false,
  chatAutoScroll: true,
  composingInput: false,
  compositionGuardUntil: 0,
  sidebarWidth: Number(localStorage.getItem("kakomimasu-sidebar-width")) || 280,
  utilityWidth: Number(localStorage.getItem("kakomimasu-utility-width")) || 520,
  timer: undefined,

  async init() {
    try {
      this.initColorScheme();
      await this.fitWindowToScreen();
      await this.$nextTick();
      sourceEditorReady = this.initSourceEditor();
      await this.refresh();
      await this.loadChatHistory();
      await this.loadSource();
      await this.pollLogs();
      this.timer = setInterval(() => this.pollLogs(), 1000);
    } catch (error) {
      this.status = "エラー: " + error.message;
    }
  },

  initColorScheme() {
    if (typeof globalThis.matchMedia !== "function") return;
    colorSchemeMediaQuery = globalThis.matchMedia("(prefers-color-scheme: dark)");
    this.darkMode = colorSchemeMediaQuery.matches;
    colorSchemeListener = (event) => {
      this.darkMode = event.matches;
      if (sourceEditor && globalThis.monaco) {
        globalThis.monaco.editor.setTheme(this.darkMode ? "vs-dark" : "vs");
      }
    };
    colorSchemeMediaQuery.addEventListener("change", colorSchemeListener);
  },

  async fitWindowToScreen() {
    const browserScreen = globalThis.screen;
    if (!browserScreen) return;
    try {
      await call("fitWindowToScreen", [{
        width: browserScreen.availWidth,
        height: browserScreen.availHeight,
        x: browserScreen.availLeft || 0,
        y: browserScreen.availTop || 0,
      }]);
    } catch {
      // 画面情報を取得できない環境では、BrowserWindowの初期サイズを使う。
    }
  },

  destroy() {
    if (this.timer) clearInterval(this.timer);
    if (colorSchemeMediaQuery && colorSchemeListener) {
      colorSchemeMediaQuery.removeEventListener("change", colorSchemeListener);
    }
    colorSchemeMediaQuery = undefined;
    colorSchemeListener = undefined;
    sourceEditorResizeObserver?.disconnect();
    sourceEditor?.dispose();
    sourceEditor = undefined;
    sourceEditorReady = undefined;
  },

  initSourceEditor() {
    return new Promise((resolve, reject) => {
      if (typeof globalThis.require !== "function") {
        reject(new Error("Monaco Editorを読み込めませんでした。"));
        return;
      }
      globalThis.require.config({ paths: { vs: "/monaco/vs" } });
      globalThis.require(
        ["vs/editor/editor.main"],
        () => {
          sourceEditor = globalThis.monaco.editor.create(this.$refs.sourceEditor, {
            value: this.source,
            language: "typescript",
            theme: this.darkMode ? "vs-dark" : "vs",
            automaticLayout: true,
            fontFamily: "SFMono-Regular, Menlo, Monaco, Consolas, monospace",
            fontSize: 13,
            lineHeight: 21,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            padding: { top: 12, bottom: 12 },
            tabSize: 2,
            insertSpaces: true,
            wordWrap: "off",
          });
          sourceEditor.onDidChangeModelContent(() => {
            this.source = sourceEditor.getValue();
          });
          sourceEditor.addCommand(
            globalThis.monaco.KeyMod.CtrlCmd | globalThis.monaco.KeyCode.KeyS,
            () => this.saveSource(),
          );
          sourceEditorResizeObserver = new ResizeObserver(() => sourceEditor?.layout());
          sourceEditorResizeObserver.observe(this.$refs.sourceEditor);
          resolve();
        },
        () => reject(new Error("Monaco Editorの初期化に失敗しました。")),
      );
    });
  },

  displayName(name) {
    return name.replace(/^v\d{3,}-/, "");
  },

  get selectedVersion() {
    return this.dashboard.versions.find((version) => version.path === this.selected);
  },

  get messages() {
    return this.selected ? this.messagesByVersion[this.selected] || [] : [];
  },

  // 今回の最終回答だけは、実行ログの後に表示する。
  get messagesBeforeCodingLogs() {
    return this.codingAgentResult?.versionDir === this.selected
      ? this.messages.slice(0, -1)
      : this.messages;
  },

  get codingAgentFinalMessage() {
    return this.codingAgentResult?.versionDir === this.selected
      ? { role: "assistant", text: this.codingAgentResult.text }
      : null;
  },

  get displayedCodingLogs() {
    const finalMessage = this.codingAgentFinalMessage;
    if (!finalMessage) return this.codingLogs;

    // 最終回答はログとは別に末尾へ表示するため、同じ内容のストリーミング
    // メッセージは1件だけ除外して重複を避ける。
    const finalLogIndex = this.codingLogs.findLastIndex(
      (log) => log.kind === "message" && log.text === finalMessage.text,
    );
    return this.codingLogs.filter((_, index) => index !== finalLogIndex);
  },

  get codingLogMessages() {
    return this.codingLogs.filter((log) => log.kind === "message");
  },

  get codingLogTools() {
    return this.codingLogs.filter((log) => log.kind === "tool");
  },

  get codingLogStatuses() {
    return this.codingLogs.filter((log) => log.kind === "status");
  },

  codingLogStatus(status) {
    return {
      in_progress: "実行中",
      completed: "完了",
      failed: "失敗",
      declined: "拒否",
    }[status] || status || "";
  },

  closeOtherCodingTools(event) {
    const openedTool = event.currentTarget;
    if (!openedTool.open) return;
    this.$refs.chatFeed?.querySelectorAll(".coding-log-tool[open]").forEach((tool) => {
      if (tool !== openedTool) tool.open = false;
    });
  },

  get chatHistoryPayload() {
    return Object.fromEntries(
      this.dashboard.versions.map((version) => [
        version.name,
        this.messagesByVersion[version.path] || [],
      ]),
    );
  },

  get boardOptions() {
    return Object.values(BOARD_PREVIEWS);
  },

  get opponentOptions() {
    return Object.values(PRACTICE_OPPONENTS);
  },

  get model() {
    return this.models[this.agent] || "";
  },

  set model(value) {
    this.models[this.agent] = value;
  },

  get modelOptions() {
    return MODEL_OPTIONS[this.agent] || [];
  },

  get selectedOpponent() {
    return PRACTICE_OPPONENTS[this.ai] || PRACTICE_OPPONENTS.a1;
  },

  get selectedBoard() {
    return BOARD_PREVIEWS[this.board] || BOARD_PREVIEWS["A-1"];
  },

  selectAgent(agent) {
    if (agent !== "codex" && agent !== "claude") return;
    this.agent = agent;
    localStorage.setItem(SAVED_AGENT_KEY, agent);
  },

  saveModel() {
    const value = this.model.trim();
    if (value && !/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(value)) {
      this.model = "";
    } else {
      this.model = value;
    }
    localStorage.setItem(SAVED_MODELS_KEY, JSON.stringify(this.models));
  },

  boardPointColor(point) {
    const strength = (this.darkMode ? 0.3 : 0.16) +
      Math.min(Math.abs(point) / 16, 1) * (this.darkMode ? 0.58 : 0.72);
    if (point < 0) return `rgba(218, 80, 61, ${strength})`;
    if (point > 0) return `rgba(48, 133, 104, ${strength})`;
    return this.darkMode ? "#3b3b37" : "#e7e7e2";
  },

  async refresh(preferred) {
    this.dashboard = await call("getDashboard");
    if (preferred || !this.dashboard.versions.some((version) => version.path === this.selected)) {
      const nextSelected = preferred || this.dashboard.versions[0]?.path || "";
      if (nextSelected !== this.selected) {
        this.rememberViewerState();
        this.selected = nextSelected;
        this.restoreViewerState(nextSelected);
      }
    }
  },

  async loadChatHistory() {
    const history = await call("getChatHistory");
    this.messagesByVersion = Object.fromEntries(
      this.dashboard.versions.map((version) => [version.path, history[version.name] || []]),
    );
  },

  async persistChatHistory() {
    try {
      await call("saveChatHistory", [this.chatHistoryPayload]);
      return true;
    } catch {
      return false;
    }
  },

  async clearChat() {
    if (!this.selected || this.busy || this.messages.length === 0) return;
    if (!confirm("このエージェントのチャット履歴をすべて削除しますか？")) return;
    this.messagesByVersion[this.selected] = [];
    const saved = await this.persistChatHistory();
    this.status = saved ? "チャット履歴をクリアしました。" : "チャット履歴を保存できませんでした。";
    this.scrollChat(true);
  },

  async selectVersion(path) {
    if (path === this.selected) return;
    this.rememberViewerState();
    this.selected = path;
    this.restoreViewerState(path);
    this.source = "";
    this.sourceStatus = "";
    this.codingLogs = [];
    if (sourceEditor?.getValue()) sourceEditor.setValue("");
    this.scrollChat(true);
    if (this.tab === "source") await this.loadSource(path);
  },

  async selectTab(tab) {
    this.tab = tab;
    if (tab === "source") {
      await this.loadSource();
      this.$nextTick(() => sourceEditor?.layout());
    }
    if (tab === "match") this.scrollMatchLogs();
  },

  async createVersion(sourceVersion) {
    const source = this.dashboard.versions.find((version) => version.path === sourceVersion);
    const initialName = source ? this.displayName(source.name) : "";
    const name = prompt("エージェント名を入力してください", initialName);
    if (!name?.trim()) return;
    this.busy = true;
    this.status = "コピー中…";
    try {
      const result = await call("createVersion", [{
        agentName: name.trim(),
        sourceVersion,
      }]);
      await this.refresh(result.version.path);
      await this.loadSource(result.version.path);
      this.status = this.displayName(result.version.name) + " を作成しました。";
    } catch (error) {
      this.status = "エラー: " + error.message;
    } finally {
      this.busy = false;
    }
  },

  async renameVersion(version) {
    const currentName = this.displayName(version.name);
    const name = prompt("新しいAI名を入力してください", currentName);
    if (!name?.trim() || name.trim() === currentName) return;
    this.busy = true;
    this.status = "名前を変更しています…";
    try {
      const previousMessages = this.messagesByVersion[version.path];
      const result = await call("renameVersion", [{
        versionDir: version.path,
        agentName: name.trim(),
      }]);
      if (previousMessages && result.version.path !== version.path) {
        this.messagesByVersion[result.version.path] = previousMessages;
        delete this.messagesByVersion[version.path];
      }
      await this.refresh(result.version.path);
      if (result.version.path !== version.path && this.viewerStates[version.path]) {
        const viewerState = this.viewerStates[version.path];
        const viewerStates = { ...this.viewerStates, [result.version.path]: viewerState };
        delete viewerStates[version.path];
        this.viewerStates = viewerStates;
        if (this.matchVersion === version.path) this.matchVersion = result.version.path;
        this.restoreViewerState(result.version.path);
      }
      await this.loadSource(result.version.path);
      const saved = await this.persistChatHistory();
      this.status = this.displayName(result.version.name) +
        (saved ? " に変更しました。" : " に変更しましたが、チャット履歴を保存できませんでした。");
    } catch (error) {
      this.status = "エラー: " + error.message;
    } finally {
      this.busy = false;
    }
  },

  async deleteVersion(version) {
    const name = this.displayName(version.name);
    if (!confirm(name + "を削除しますか？")) return;
    try {
      await call("deleteVersion", [version.path]);
      delete this.messagesByVersion[version.path];
      await this.refresh();
      if (this.viewerStates[version.path]) {
        const viewerStates = { ...this.viewerStates };
        delete viewerStates[version.path];
        this.viewerStates = viewerStates;
      }
      await this.loadSource();
      const saved = await this.persistChatHistory();
      this.status = name +
        (saved ? " を削除しました。" : " を削除しましたが、チャット履歴を保存できませんでした。");
    } catch (error) {
      this.status = "エラー: " + error.message;
    }
  },

  startComposition() {
    this.composingInput = true;
    this.compositionGuardUntil = 0;
  },

  endComposition() {
    this.composingInput = false;
    // WebKitでは変換確定時のEnterより先にcompositionendが発火する場合がある。
    this.compositionGuardUntil = performance.now() + 150;
  },

  clearCompositionGuard() {
    this.compositionGuardUntil = 0;
  },

  sendOnEnter(event) {
    const duringComposition = this.composingInput || event.isComposing || event.keyCode === 229 ||
      event.key === "Process";
    const justFinishedComposition = performance.now() < this.compositionGuardUntil;
    if (event.shiftKey || duringComposition || justFinishedComposition) return;
    event.preventDefault();
    this.improve();
  },

  async improve() {
    const idea = this.idea.trim();
    if (!idea || !this.selected || this.busy) return;
    const versionDir = this.selected;
    if (!this.messagesByVersion[versionDir]) this.messagesByVersion[versionDir] = [];
    const messages = this.messagesByVersion[versionDir];
    messages.push({ role: "user", text: idea });
    await this.persistChatHistory();
    this.idea = "";
    this.busy = true;
    this.codingAgentRunning = true;
    this.codingAgentResult = null;
    this.status = "AIを起動しています…";
    this.scrollChat(true);
    try {
      const result = await call("improveWithAgent", [{
        idea,
        versionDir,
        agent: this.agent,
        model: this.model,
      }]);
      messages.push({ role: "assistant", text: result.output });
      this.codingAgentResult = { versionDir, text: result.output };
      const saved = await this.persistChatHistory();
      if (result.cancelled) {
        this.status = saved
          ? "改善を停止しました。"
          : "改善を停止しましたが、履歴を保存できませんでした。";
      } else {
        this.status = saved
          ? "改善が完了しました。"
          : "改善は完了しましたが、履歴を保存できませんでした。";
      }
    } catch (error) {
      const text = "エラー: " + error.message;
      messages.push({ role: "assistant", text });
      this.codingAgentResult = { versionDir, text };
      const saved = await this.persistChatHistory();
      this.status = "エラー: " + error.message +
        (saved ? "" : "（チャット履歴も保存できませんでした）");
    } finally {
      // AIは別プロセスで main.ts を編集するため、完了時にファイルから読み直して
      // 右側のソースエディタにも変更内容を反映する。
      await this.loadSource(versionDir);
      this.busy = false;
      this.codingAgentRunning = false;
      this.scrollChat();
    }
  },

  async cancelImprove() {
    if (!this.codingAgentRunning || this.stopping) return;
    this.stopping = true;
    this.status = "コーディングAIの停止を要求しています…";
    try {
      const result = await call("stopCodingAgent");
      if (this.codingAgentRunning) this.status = result.message;
    } catch (error) {
      if (this.codingAgentRunning) this.status = "エラー: " + error.message;
    } finally {
      this.stopping = false;
    }
  },

  async loadSource(versionPath = this.selected) {
    if (!versionPath) {
      this.source = "";
      this.sourceStatus = "";
      await sourceEditorReady;
      if (sourceEditor.getValue() !== this.source) sourceEditor.setValue(this.source);
      return;
    }
    this.sourceStatus = "読み込み中…";
    try {
      const nextSource = await call("getSource", [versionPath]);
      if (this.selected !== versionPath) return;
      this.source = nextSource;
      await sourceEditorReady;
      if (this.selected !== versionPath) return;
      if (sourceEditor.getValue() !== this.source) sourceEditor.setValue(this.source);
      sourceEditor.layout();
      this.sourceStatus = "";
    } catch (error) {
      if (this.selected === versionPath) this.sourceStatus = "エラー: " + error.message;
    }
  },

  async saveSource() {
    if (!this.selected || this.busy) return;
    this.busy = true;
    this.sourceStatus = "保存しています…";
    try {
      await sourceEditorReady;
      this.source = sourceEditor.getValue();
      const result = await call("saveSource", [this.selected, this.source]);
      this.sourceStatus = result.message;
    } catch (error) {
      this.sourceStatus = "エラー: " + error.message;
    } finally {
      this.busy = false;
    }
  },

  async reloadSourceAfterFileChange(versionPath) {
    if (this.sourceReloadingAfterFileChange) {
      this.sourceReloadPendingAfterFileChange = true;
      return;
    }

    this.sourceReloadingAfterFileChange = true;
    try {
      do {
        this.sourceReloadPendingAfterFileChange = false;
        await this.loadSource(versionPath);
      } while (this.sourceReloadPendingAfterFileChange && this.selected === versionPath);
    } finally {
      this.sourceReloadingAfterFileChange = false;
    }
  },

  async startMatch() {
    if (!this.selected || this.busy) return;
    this.matchVersion = this.selected;
    this.busy = true;
    this.matchStatus = "参加しています…";
    this.viewerOpen = false;
    this.viewerLoading = false;
    this.viewerUrl = "";
    this.rememberViewerState();
    this.matchLogs = [];
    try {
      const result = await call("startMatch", [{
        agentName: this.displayName(this.selectedVersion?.name || "エルメマス"),
        aiName: this.ai,
        board: this.board,
        versionDir: this.selected,
      }]);
      this.matchStatus = result.message;
      this.viewerUrl = result.viewerUrl;
      this.rememberViewerState();
      this.matchRunning = true;
    } catch (error) {
      this.matchStatus = "エラー: " + error.message;
    } finally {
      this.busy = false;
      this.scrollMatchLogs();
    }
  },

  openViewer() {
    try {
      const url = new URL(this.viewerUrl);
      if (
        url.origin !== "https://kakomimasu.com" || url.pathname !== "/game" ||
        !url.searchParams.get("id")
      ) throw new Error();
    } catch {
      this.matchStatus = "エラー: 対戦画面のURLを確認できませんでした。";
      return;
    }
    this.viewerLoading = true;
    this.viewerOpen = true;
    this.rememberViewerState();
  },

  closeViewer() {
    this.viewerOpen = false;
    this.viewerLoading = false;
    this.rememberViewerState();
    this.scrollChat(true);
  },

  rememberViewerState(path = this.selected) {
    if (!path) return;
    this.viewerStates = {
      ...this.viewerStates,
      [path]: { url: this.viewerUrl, open: this.viewerOpen },
    };
  },

  restoreViewerState(path) {
    const state = this.viewerStates[path];
    this.viewerUrl = state?.url || "";
    this.viewerOpen = Boolean(state?.open && state.url);
    this.viewerLoading = this.viewerOpen;
  },

  async pollLogs() {
    try {
      const [match, codingAgentState] = await Promise.all([
        call("getMatchLogs"),
        call("getCodingAgentLogs"),
      ]);
      this.matchLogs = match.logs;
      if (match.viewerUrl) {
        const versionPath = this.matchVersion || this.selected;
        if (versionPath) {
          const viewerState = this.viewerStates[versionPath] || { url: "", open: false };
          this.viewerStates = {
            ...this.viewerStates,
            [versionPath]: { ...viewerState, url: match.viewerUrl },
          };
          if (versionPath === this.selected) this.viewerUrl = match.viewerUrl;
        }
      }
      this.matchRunning = match.running;
      this.codingLogs = codingAgentState.versionDir === this.selected ? codingAgentState.logs : [];
      const completedFileChangeLogIds = new Set(
        this.codingLogs
          .filter((log) => log.title === "ファイル変更" && log.status === "completed")
          .map((log) => log.id),
      );
      const sourceChanged = [...completedFileChangeLogIds].some(
        (id) => !this.completedFileChangeLogIds.has(id),
      );
      this.completedFileChangeLogIds = completedFileChangeLogIds;
      if (sourceChanged && this.selected) {
        await this.reloadSourceAfterFileChange(this.selected);
      }
      if (this.tab === "match") this.scrollMatchLogs();
      if (this.busy) this.scrollChat();
    } catch {
      // Desktop終了中などの一時的な取得失敗は次回のポーリングで回復する。
    }
  },

  updateChatScrollState() {
    const feed = this.$refs.chatFeed;
    if (!feed) return;
    const distanceFromBottom = feed.scrollHeight - feed.clientHeight - feed.scrollTop;
    this.chatAutoScroll = distanceFromBottom <= 24;
  },

  scrollChat(force = false) {
    this.$nextTick(() => {
      const feed = this.$refs.chatFeed;
      if (!feed || (!force && !this.chatAutoScroll)) return;
      feed.scrollTop = feed.scrollHeight;
      this.chatAutoScroll = true;
    });
  },

  scrollMatchLogs() {
    this.$nextTick(() => {
      if (this.$refs.matchOutput) {
        this.$refs.matchOutput.scrollTop = this.$refs.matchOutput.scrollHeight;
      }
    });
  },

  startResize(event) {
    const move = (pointerEvent) => {
      this.sidebarWidth = Math.max(240, Math.min(520, pointerEvent.clientX));
    };
    const stop = () => {
      globalThis.removeEventListener("pointermove", move);
      globalThis.removeEventListener("pointerup", stop);
      localStorage.setItem("kakomimasu-sidebar-width", String(this.sidebarWidth));
    };
    globalThis.addEventListener("pointermove", move);
    globalThis.addEventListener("pointerup", stop);
    event.preventDefault();
  },

  startUtilityResize(event) {
    const move = (pointerEvent) => {
      const minimumCenterWidth = 320;
      const availableWidth = globalThis.innerWidth - this.sidebarWidth - minimumCenterWidth - 12;
      const maximumWidth = Math.max(340, Math.min(760, availableWidth));
      const requestedWidth = globalThis.innerWidth - pointerEvent.clientX;
      this.utilityWidth = Math.max(340, Math.min(maximumWidth, requestedWidth));
    };
    const stop = () => {
      globalThis.removeEventListener("pointermove", move);
      globalThis.removeEventListener("pointerup", stop);
      localStorage.setItem("kakomimasu-utility-width", String(this.utilityWidth));
    };
    globalThis.addEventListener("pointermove", move);
    globalThis.addEventListener("pointerup", stop);
    event.preventDefault();
  },
});
