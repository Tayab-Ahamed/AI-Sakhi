import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { clearDeviceData } from "./device-data";

afterEach(() => { vi.unstubAllGlobals(); localStorage.clear(); sessionStorage.clear(); });

describe("shared-device cleanup cache boundary", () => {
  it("preserves only the current public asset cache while erasing private and legacy copies", async () => {
    const worker = readFileSync(resolve(process.cwd(), "public/sw.js"), "utf8");
    const current = /const CACHE_NAME = "([^"]+)"/.exec(worker)?.[1];
    expect(current).toBeDefined();
    const stored = new Set([current!, "sakhi-public-v2", "sakhi-api-v1", "sakhi-private", "unrelated-app"]);
    vi.stubGlobal("caches", {
      keys: async () => [...stored],
      delete: async (key: string) => stored.delete(key),
    });
    localStorage.setItem("sakhi_user", "synthetic private profile");
    localStorage.setItem("sakhi_offline_quiz_cache", "synthetic private quiz");
    localStorage.setItem("sakhi_diagnostic_attempt:1:1:8", "00000000-0000-4000-8000-000000000001");
    localStorage.setItem("sakhi_logout_pending", "true");
    sessionStorage.setItem("sakhi_session", "synthetic session");
    await clearDeviceData();
    expect([...stored].sort()).toEqual([current!, "unrelated-app"].sort());
    expect(localStorage.getItem("sakhi_user")).toBeNull();
    expect(localStorage.getItem("sakhi_offline_quiz_cache")).toBeNull();
    expect(localStorage.getItem("sakhi_diagnostic_attempt:1:1:8")).toBeNull();
    expect(localStorage.getItem("sakhi_logout_pending")).toBe("true");
    expect(sessionStorage.getItem("sakhi_session")).toBeNull();
  });
});
