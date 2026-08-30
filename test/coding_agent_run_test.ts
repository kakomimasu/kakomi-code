import { assert, assertEquals } from "@std/assert";
import { createCodingAgentRun, requestCodingAgentStop } from "../desktop/coding_agent_run.ts";

Deno.test("プロセス起動前の停止要求も実行全体に保持する", () => {
  const run = createCodingAgentRun();
  const calls: boolean[] = [];
  assert(requestCodingAgentStop(run, { terminate: (_process, force) => calls.push(!!force) }));
  assert(run.stopRequested);
  assert(run.abortController.signal.aborted);
  assertEquals(calls, []);
  assertEquals(requestCodingAgentStop(run), false);
});

Deno.test("停止時は同じプロセスツリーへ通常終了後すぐ強制終了を送る", () => {
  const run = createCodingAgentRun();
  run.process = { pid: 1234, kill() {} } as Deno.ChildProcess;
  const calls: boolean[] = [];
  assert(
    requestCodingAgentStop(run, {
      terminate: (_process, force) => calls.push(!!force),
    }),
  );
  assertEquals(calls, [false, true]);
});

Deno.test("通常終了の送信に失敗しても同じプロセスツリーを強制終了する", () => {
  const run = createCodingAgentRun();
  run.process = { pid: 1234, kill() {} } as Deno.ChildProcess;
  const calls: boolean[] = [];
  assert(
    requestCodingAgentStop(run, {
      terminate: (_process, force) => {
        calls.push(!!force);
        if (!force) throw new Error("graceful signal failed");
      },
    }),
  );
  assertEquals(calls, [false, true]);
});
