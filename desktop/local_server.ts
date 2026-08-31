import { hasValidApiToken, isTrustedLoopbackRequest } from "./http_security.ts";
import { readJsonBody, RequestBodyTooLargeError } from "./request_body.ts";
import { resolveStaticAsset, staticContentType } from "./static_assets.ts";

export type ApiHandler = (...args: unknown[]) => unknown | Promise<unknown>;

type LocalRequestHandlerOptions = {
  apiToken: string;
  apiHandlers: ReadonlyMap<string, ApiHandler>;
  staticRoot: URL;
};

const API_PATH_PREFIX = "/api/bindings/";
const MAX_API_BODY_BYTES = 12 * 1024 * 1024;

export function createLocalRequestHandler(options: LocalRequestHandlerOptions) {
  return async (request: Request): Promise<Response> => {
    const url = new URL(request.url);
    const origin = request.headers.get("origin");
    if (!isTrustedLoopbackRequest(url, origin)) {
      return new Response("Forbidden", { status: 403 });
    }
    if (request.method === "POST" && url.pathname.startsWith(API_PATH_PREFIX)) {
      return await handleApiRequest(request, url, options);
    }
    return await serveStaticFile(request, url.pathname, options.staticRoot, options.apiToken);
  };
}

async function handleApiRequest(
  request: Request,
  url: URL,
  options: LocalRequestHandlerOptions,
): Promise<Response> {
  const contentType = request.headers.get("content-type") ?? "";
  if (
    !hasValidApiToken(request.headers, options.apiToken) ||
    !contentType.startsWith("application/json")
  ) {
    return Response.json({ error: "許可されていないリクエストです。" }, { status: 403 });
  }
  try {
    const name = decodeURIComponent(url.pathname.slice(API_PATH_PREFIX.length));
    const handler = options.apiHandlers.get(name);
    if (!handler) return Response.json({ error: "APIが見つかりません。" }, { status: 404 });
    const body = await readJsonBody(request, MAX_API_BODY_BYTES) as { args?: unknown[] };
    const result = await handler(...(Array.isArray(body.args) ? body.args : []));
    return Response.json({ result });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : String(error) }, {
      status: error instanceof RequestBodyTooLargeError ? 413 : 400,
    });
  }
}

async function serveStaticFile(
  request: Request,
  pathname: string,
  staticRoot: URL,
  apiToken: string,
): Promise<Response> {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method not allowed", { status: 405 });
  }
  const asset = await resolveStaticAsset(staticRoot, pathname);
  if (!asset) return new Response("Not found", { status: 404 });
  try {
    let body = await Deno.readFile(asset.file);
    if (asset.relativePath === "index.html") {
      const html = new TextDecoder().decode(body).replace("__KAKOMI_API_TOKEN__", apiToken);
      body = new TextEncoder().encode(html);
    }
    return new Response(request.method === "HEAD" ? null : body, {
      headers: {
        "cache-control": asset.relativePath.startsWith("assets/")
          ? "public, max-age=31536000, immutable"
          : "no-cache",
        "content-type": staticContentType(asset.relativePath),
      },
    });
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) return new Response("Not found", { status: 404 });
    throw error;
  }
}
