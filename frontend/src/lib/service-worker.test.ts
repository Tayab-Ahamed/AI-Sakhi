// @vitest-environment node
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

const source = readFileSync(new URL("../../public/sw.js", import.meta.url), "utf8");

function worker(cacheControl = "no-store", cookie = false) {
  const handlers: Record<string, (event: unknown) => void> = {};
  const response = { ok: true, type: "basic", headers: new Headers({ "cache-control": cacheControl, ...(cookie ? { "set-cookie": "test" } : {}) }), clone: () => response };
  const cache = { match: vi.fn().mockResolvedValue(undefined), put: vi.fn(), addAll: vi.fn() };
  const fetch = vi.fn().mockResolvedValue(response);
  runInNewContext(source, {
    self: { location: { origin: "https://test.local" }, addEventListener: (name: string, handler: (event: unknown) => void) => { handlers[name] = handler; } },
    caches: { open: vi.fn().mockResolvedValue(cache) }, URL, fetch,
  });
  async function request(path: string, method = "GET") {
    let result: Promise<unknown> | undefined;
    handlers.fetch({ request: { url: new URL(path, "https://test.local").href, method, mode: "cors" }, respondWith: (value: Promise<unknown>) => { result = value; } });
    await result;
    return result !== undefined;
  }
  return { request, cache, fetch };
}

describe("public service worker cache policy", () => {
  it("does not intercept APIs, cross-origin requests or writes", async () => {
    const w = worker("public, immutable");
    for (const [path, method] of [["/api/backend/user/1", "GET"], ["https://other.local/_next/static/a.js", "GET"], ["/_next/static/a.js", "POST"]]) {
      expect(await w.request(path, method)).toBe(false);
    }
    expect(w.fetch).not.toHaveBeenCalled();
  });
  it("does not persist development chunks", async () => {
    const w = worker();
    expect(await w.request("/_next/static/chunks/dev.js")).toBe(true);
    expect(w.cache.put).not.toHaveBeenCalled();
  });
  it("persists immutable production chunks", async () => {
    const w = worker("public, max-age=31536000, immutable");
    await w.request("/_next/static/chunks/hash.js");
    expect(w.cache.put).toHaveBeenCalledOnce();
  });
  it("rejects cookie-setting responses even when immutable", async () => {
    const w = worker("public, immutable", true);
    await w.request("/_next/static/chunks/hash.js");
    expect(w.cache.put).not.toHaveBeenCalled();
  });
  it("allows only the explicit offline assets without immutable headers", async () => {
    const w = worker();
    await w.request("/offline.html");
    expect(w.cache.put).toHaveBeenCalledOnce();
    expect(await w.request("/private-export.json")).toBe(false);
  });
});
