import { terminateProcessTree } from "./process_tree.ts";

export type CodingAgentRun = {
  abortController: AbortController;
  process?: Deno.ChildProcess;
  stopRequested: boolean;
};

type StopOptions = {
  onForce?: () => void;
  terminate?: (
    process: Pick<Deno.ChildProcess, "pid" | "kill">,
    force?: boolean,
  ) => void;
};

export function createCodingAgentRun(): CodingAgentRun {
  return { abortController: new AbortController(), stopRequested: false };
}

export function attachCodingAgentProcess(
  run: CodingAgentRun,
  process: Deno.ChildProcess,
): boolean {
  if (run.stopRequested) {
    terminateProcessTree(process, true);
    return false;
  }
  run.process = process;
  return true;
}

export function detachCodingAgentProcess(run: CodingAgentRun, process: Deno.ChildProcess): void {
  if (run.process === process) run.process = undefined;
}

export function requestCodingAgentStop(run: CodingAgentRun, options: StopOptions = {}): boolean {
  if (run.stopRequested) return false;
  run.stopRequested = true;
  run.abortController.abort();
  const process = run.process;
  if (!process) return true;

  const terminate = options.terminate ?? terminateProcessTree;
  try {
    terminate(process);
  } catch {
    // Continue with the forceful attempt in case only the graceful signal failed.
  }
  // Do not retain a PID for a delayed kill: it may be reused by an unrelated
  // process before the timer fires. Both signals target the same live handle now.
  try {
    terminate(process, true);
    options.onForce?.();
  } catch {
    // The complete process tree already exited after the graceful signal.
  }
  return true;
}

export function forceStopCodingAgentRun(run: CodingAgentRun): void {
  run.stopRequested = true;
  run.abortController.abort();
  if (run.process) terminateProcessTree(run.process, true);
}
