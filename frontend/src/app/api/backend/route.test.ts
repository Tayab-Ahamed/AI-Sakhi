// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "./[...path]/route";

afterEach(() => vi.unstubAllGlobals());

describe("same-origin session proxy", () => {
  it("forwards cookies and CSRF but does not forward browser bearer credentials", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response("{}", { headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetch);
    await POST(new NextRequest("http://localhost/api/backend/auth/logout", { method: "POST", body: "{}", headers: { cookie: "sakhi_token=private", "x-csrf-token": "csrf", authorization: "Bearer legacy" } }), { params: Promise.resolve({ path: ["auth", "logout"] }) });
    const options = fetch.mock.calls[0][1];
    expect(options.headers.get("cookie")).toBe("sakhi_token=private");
    expect(options.headers.get("x-csrf-token")).toBe("csrf");
    expect(options.headers.has("authorization")).toBe(false);
    expect(options.cache).toBe("no-store");
  });
  it("passes all session cookies back and forbids response caching", async () => {
    const headers = new Headers({ "Content-Type": "application/json" });
    headers.append("set-cookie", "sakhi_token=private; HttpOnly; Path=/");
    headers.append("set-cookie", "sakhi_csrf=csrf; Path=/");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { headers })));
    const result = await GET(new NextRequest("http://localhost/api/backend/auth/session"), { params: Promise.resolve({ path: ["auth", "session"] }) });
    expect(result.headers.getSetCookie()).toHaveLength(2);
    expect(result.headers.get("cache-control")).toBe("no-store");
  });
  it("preserves streaming data without buffering the upstream response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("data: hello\n\n", { headers: { "Content-Type": "text/event-stream" } })));
    const result = await GET(new NextRequest("http://localhost/api/backend/chat/stream"), { params: Promise.resolve({ path: ["chat", "stream"] }) });
    expect(await result.text()).toBe("data: hello\n\n");
    expect(result.headers.get("content-type")).toBe("text/event-stream");
  });
  it("rejects path traversal before making an upstream request", async () => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    const result = await GET(new NextRequest("http://localhost/api/backend/anything"), { params: Promise.resolve({ path: ["..", "secret"] }) });
    expect(result.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("returns a generic non-cacheable failure when upstream is unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("private backend hostname")));
    const result = await GET(new NextRequest("http://localhost/api/backend/auth/session"), { params: Promise.resolve({ path: ["auth", "session"] }) });
    expect(result.status).toBe(503);
    expect(await result.text()).not.toContain("private backend hostname");
    expect(result.headers.get("cache-control")).toBe("no-store");
  });
});
