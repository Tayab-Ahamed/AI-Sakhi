import { LocalStore } from "./store/local-store";

// Keep in sync with public/sw.js; the regression test checks this exact boundary.
// Older public-cache versions are not trusted to have today's asset-only policy.
const PUBLIC_ASSET_CACHE = "sakhi-public-v3";

/** Erase device copies on a shared device. A pending logout marker is retained. */
export async function clearDeviceData(userId?: number) {
  if (typeof window === "undefined") return;
  let deviceError: unknown;
  if (userId !== undefined) {
    const store = new LocalStore();
    try { await store.clearUser(userId); }
    catch (error) { deviceError = error; }
    finally { store.close(); }
  }
  const keys = Object.keys(localStorage).filter((key) => key.startsWith("sakhi_") && !["sakhi_logout_pending", "sakhi_theme"].includes(key));
  for (const key of keys) localStorage.removeItem(key);
  sessionStorage.removeItem("sakhi_session");
  if ("caches" in window) {
    for (const key of await caches.keys()) {
      if (key.startsWith("sakhi-") && key !== PUBLIC_ASSET_CACHE) await caches.delete(key);
    }
  }
  navigator.serviceWorker?.controller?.postMessage({ type: "CLEAR_PRIVATE_DATA" });
  if (deviceError) throw deviceError;
}
