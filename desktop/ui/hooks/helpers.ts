export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function nextFrame(callback?: () => void): Promise<void> {
  return new Promise((resolve) => {
    const run = () => {
      callback?.();
      resolve();
    };
    if (typeof globalThis.requestAnimationFrame === "function") {
      globalThis.requestAnimationFrame(run);
    } else {
      queueMicrotask(run);
    }
  });
}

export function displayVersionName(name: string): string {
  return name.replace(/^v\d{3,}-/, "");
}
