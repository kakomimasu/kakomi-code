import { assertEquals, assertRejects, assertStringIncludes } from "@std/assert";
import { join } from "@std/path";
import { loadChatHistory, saveChatHistory } from "../desktop/chat_history.ts";
import { BASE_VERSION_NAME } from "../desktop/version_manager.ts";
import { openApp, submitName, versionRow, withTestApp } from "./fixture.ts";

Deno.test("E2E: 作成したAIのコードを保存・再読込・複製・名前変更・削除できる", async () => {
  await withTestApp("version-lifecycle", async ({ page, projectDir, url }) => {
    await openApp(page, url);
    await page.getByRole("button", { name: "テンプレートをベースに新規作成" }).click();
    await submitName(page, "高得点作戦", "作成");
    await page.getByText("高得点作戦 を作成しました。", { exact: true }).waitFor();
    const sourcePath = join(projectDir, "versions/v002-高得点作戦/main.ts");
    assertEquals(
      await Deno.readTextFile(sourcePath),
      await Deno.readTextFile(join(projectDir, "template/main.ts")),
    );

    const editor = page.getByRole("region", { name: "main.ts ソースコードエディタ" });
    await editor.locator(".view-lines").click();
    await page.keyboard.press("ControlOrMeta+A");
    const source = 'export const strategy = "high-score";';
    await page.keyboard.insertText(source);
    await page.getByRole("button", { name: "保存 *", exact: true }).click();
    await page.getByText("main.tsを保存しました。", { exact: true }).waitFor();
    assertEquals(await Deno.readTextFile(sourcePath), source);

    await page.reload();
    await versionRow(page, "高得点作戦").getByRole("button", { name: "高得点作戦", exact: true })
      .click();
    await editor.locator(".view-line").filter({ hasText: "high-score" }).waitFor();
    assertStringIncludes(await editor.locator(".view-lines").innerText(), "high-score");
    await versionRow(page, "高得点作戦").getByRole("button", { name: "この版を複製" }).click();
    await submitName(page, "改良作戦", "複製");
    await page.getByText("改良作戦 を作成しました。", { exact: true }).waitFor();
    assertEquals(
      await Deno.readTextFile(join(projectDir, "versions/v003-改良作戦/main.ts")),
      source,
    );

    await versionRow(page, "改良作戦").getByRole("button", { name: "名前を変更" }).click();
    await submitName(page, "完成作戦", "変更");
    await page.getByText("完成作戦 に変更しました。", { exact: true }).waitFor();
    const renamed = join(projectDir, "versions/v003-完成作戦");
    assertEquals(await Deno.readTextFile(join(renamed, "main.ts")), source);

    await versionRow(page, "完成作戦").getByRole("button", { name: "この版を削除" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "キャンセル" }).click();
    assertEquals(await Deno.readTextFile(join(renamed, "main.ts")), source);
    await versionRow(page, "完成作戦").getByRole("button", { name: "この版を削除" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "削除", exact: true }).click();
    await page.getByText("完成作戦 を削除しました。", { exact: true }).waitFor();
    await versionRow(page, "完成作戦").waitFor({ state: "detached" });
    await assertRejects(() => Deno.stat(renamed), Deno.errors.NotFound);
    assertEquals(await Deno.readTextFile(sourcePath), source);
  });
});

Deno.test("E2E: 名前変更後も履歴が残り、クリアすると再読込後も消えている", async () => {
  await withTestApp("chat-history", async ({ page, chatHistoryFile, url }) => {
    const messages = [
      { role: "user" as const, text: "角のマスを優先してください" },
      { role: "assistant" as const, text: "角を優先する作戦に変更しました" },
    ];
    await saveChatHistory(chatHistoryFile, { [BASE_VERSION_NAME]: messages });
    await openApp(page, url);
    const history = page.getByRole("log", { name: "チャット履歴" });
    await history.getByText(messages[1].text, { exact: true }).waitFor();
    await versionRow(page, BASE_VERSION_NAME).getByRole("button", { name: "名前を変更" }).click();
    await submitName(page, "角を狙う", "変更");
    await page.getByText("角を狙う に変更しました。", { exact: true }).waitFor();
    assertEquals(await loadChatHistory(chatHistoryFile), { "v001-角を狙う": messages });
    await page.reload();
    await history.getByText(messages[0].text, { exact: true }).waitFor();
    await history.getByText(messages[1].text, { exact: true }).waitFor();

    await page.getByRole("button", { name: "チャットをクリア", exact: true }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "クリア", exact: true })
      .click();
    await page.getByText("チャット履歴をクリアしました。", { exact: true }).waitFor();
    assertEquals(await loadChatHistory(chatHistoryFile), {});
    await page.reload();
    await history.getByRole("heading", { name: "どんな作戦にしますか？" }).waitFor();
    assertEquals(await history.getByText(messages[0].text, { exact: true }).count(), 0);
    assertEquals(
      await page.getByRole("button", { name: "チャットをクリア", exact: true }).isEnabled(),
      false,
    );
  });
});

Deno.test("E2E: ローカルAPIはトークンなし・異なるOrigin・管理範囲外の保存を拒否する", async () => {
  await withTestApp("api-boundaries", async ({ page, projectDir, url }) => {
    await openApp(page, url);
    const endpoint = `${url}/api/bindings/saveSource`;
    const outside = join(projectDir, "template/main.ts");
    const original = await Deno.readTextFile(outside);
    const data = { args: [outside, "書き換えてはいけない"] };
    const withoutToken = await page.request.post(endpoint, { data });
    assertEquals(withoutToken.status(), 403);
    const token = await page.locator('meta[name="kakomi-api-token"]').getAttribute("content");
    const foreignOrigin = await page.request.post(endpoint, {
      data,
      headers: { "x-kakomi-api-token": token!, origin: "https://example.com" },
    });
    assertEquals(foreignOrigin.status(), 403);
    const outsideWorkspace = await page.request.post(endpoint, {
      data,
      headers: { "x-kakomi-api-token": token!, origin: url },
    });
    assertEquals(outsideWorkspace.status(), 400);
    assertEquals(await Deno.readTextFile(outside), original);
  });
});
