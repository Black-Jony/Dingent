import type { NextRequest } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";
const BASE_PATH = "/dingent-resource";

/** Forward an SSE response without buffering it in a Next.js rewrite. */
export async function proxyStream(req: NextRequest): Promise<Response> {
  const { search } = req.nextUrl;
  let { pathname } = req.nextUrl;

  if (pathname.startsWith(BASE_PATH)) {
    pathname = pathname.slice(BASE_PATH.length);
  }

  const headers = new Headers(req.headers);
  headers.delete("host");
  headers.delete("connection");
  headers.delete("content-length");

  const body =
    req.method === "GET" || req.method === "HEAD"
      ? undefined
      : await req.text();
  const backendResponse = await fetch(`${BACKEND_URL}${pathname}${search}`, {
    method: req.method,
    headers,
    body,
    cache: "no-store",
    signal: req.signal,
  });

  const responseHeaders = new Headers(backendResponse.headers);
  responseHeaders.delete("content-encoding");
  responseHeaders.delete("content-length");
  responseHeaders.delete("transfer-encoding");
  responseHeaders.delete("connection");

  return new Response(backendResponse.body, {
    status: backendResponse.status,
    statusText: backendResponse.statusText,
    headers: responseHeaders,
  });
}
