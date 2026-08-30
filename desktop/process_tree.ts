export function spawnProcessTree(
  command: string,
  options: Deno.CommandOptions,
): Deno.ChildProcess {
  return new Deno.Command(command, { ...options, detached: true }).spawn();
}

export function taskkillArgs(pid: number, force: boolean): string[] {
  return ["/PID", String(pid), "/T", ...(force ? ["/F"] : [])];
}

export function terminateProcessTree(
  process: Pick<Deno.ChildProcess, "pid" | "kill">,
  force = false,
  os: typeof Deno.build.os = Deno.build.os,
): void {
  const signal: Deno.Signal = force ? "SIGKILL" : "SIGTERM";
  try {
    if (os === "windows") {
      const result = new Deno.Command("taskkill", {
        args: taskkillArgs(process.pid, force),
        stdin: "null",
        stdout: "null",
        stderr: "null",
      }).outputSync();
      if (result.success) return;
    } else {
      // A detached child is the leader of its own process group. A negative PID
      // signals that entire group, including tools and hooks started by the CLI.
      Deno.kill(-process.pid, signal);
      return;
    }
  } catch {
    // Fall back to the direct child when the process group has already exited.
  }
  process.kill(signal);
}
