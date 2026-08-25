const LOOPBACK_HOSTNAMES = new Set(["127.0.0.1", "localhost", "[::1]"]);

export function isTrustedLoopbackRequest(url: URL, origin: string | null): boolean {
  if (url.protocol !== "http:" || !LOOPBACK_HOSTNAMES.has(url.hostname)) return false;
  if (!origin) return true;
  try {
    return new URL(origin).origin === url.origin;
  } catch {
    return false;
  }
}

export function hasValidApiToken(headers: Headers, expectedToken: string): boolean {
  const suppliedToken = headers.get("x-kakomi-api-token");
  return suppliedToken !== null && suppliedToken === expectedToken;
}
