type DesktopBinding = (...args: unknown[]) => Promise<unknown>;

declare global {
  var bindings: Record<string, DesktopBinding> | undefined;
}

const apiToken =
  document.querySelector<HTMLMetaElement>('meta[name="kakomi-api-token"]')?.content ??
    "";

export async function callDesktop<T>(name: string, args: unknown[] = []): Promise<T> {
  const binding = globalThis.bindings?.[name];
  if (binding) return await binding(...args) as T;

  const response = await fetch(`/api/bindings/${encodeURIComponent(name)}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-kakomi-api-token": apiToken,
    },
    body: JSON.stringify({ args }),
  });
  const text = await response.text();
  let payload: { result?: T; error?: string };
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error("Desktopアプリとの接続に失敗しました。アプリを再起動してください。");
  }
  if (!response.ok) throw new Error(payload.error || `${name}に失敗しました。`);
  return payload.result as T;
}
