import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  if (path.some((segment) => segment === "." || segment === ".." || segment.includes("/") || segment.includes("\\"))) {
    return Response.json({ detail: "Invalid service path" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
  const base = new URL(process.env.BACKEND_URL || "http://127.0.0.1:8000");
  base.pathname = `${base.pathname.replace(/\/$/, "")}/${path.map(encodeURIComponent).join("/")}`;
  base.search = request.nextUrl.search;
  const headers = new Headers();
  for (const name of ["content-type", "cookie", "x-csrf-token", "accept", "idempotency-key"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  try {
    const upstream = await fetch(base, {
      method: request.method, headers, cache: "no-store", redirect: "manual",
      body: ["GET", "HEAD"].includes(request.method) ? undefined : await request.arrayBuffer(),
      signal: request.signal,
    });
    const responseHeaders = new Headers({ "Cache-Control": "no-store" });
    for (const name of ["content-type", "x-request-id", "retry-after", "x-accel-buffering"]) {
      const value = upstream.headers.get(name);
      if (value) responseHeaders.set(name, value);
    }
    for (const cookie of upstream.headers.getSetCookie()) responseHeaders.append("set-cookie", cookie);
    return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
  } catch {
    return Response.json({ detail: "The learning service is temporarily unavailable." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}

export { proxy as GET, proxy as POST, proxy as PUT, proxy as PATCH, proxy as DELETE };
