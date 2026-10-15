// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { observeWorkerUpdates } from "./pwa-updates";

class Worker extends EventTarget {
  state = "installing";
  postMessage = vi.fn();
}

async function fixture(waiting = false) {
  const worker = new Worker();
  const registration = Object.assign(new EventTarget(), { installing: worker, waiting: waiting ? worker : null });
  const container = Object.assign(new EventTarget(), {
    controller: null as Worker | null,
    register: vi.fn().mockResolvedValue(registration),
  });
  const available = vi.fn();
  const reload = vi.fn();
  const updates = observeWorkerUpdates(container as unknown as ServiceWorkerContainer, available, reload);
  await Promise.resolve();
  return { worker, registration, container, available, reload, updates };
}

describe("service worker update lifecycle", () => {
  it("does not reload forms when the first worker takes control", async () => {
    const f = await fixture();
    f.container.controller = f.worker;
    f.container.dispatchEvent(new Event("controllerchange"));
    expect(f.reload).not.toHaveBeenCalled();
    f.updates.dispose();
  });

  it("offers an installed update and refreshes only once after explicit acceptance", async () => {
    const f = await fixture();
    f.container.controller = new Worker();
    f.registration.dispatchEvent(new Event("updatefound"));
    f.worker.state = "installed";
    f.worker.dispatchEvent(new Event("statechange"));
    expect(f.available).toHaveBeenCalledOnce();
    f.container.dispatchEvent(new Event("controllerchange"));
    expect(f.reload).not.toHaveBeenCalled();
    f.updates.applyUpdate();
    expect(f.worker.postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" });
    f.container.dispatchEvent(new Event("controllerchange"));
    f.container.dispatchEvent(new Event("controllerchange"));
    expect(f.reload).toHaveBeenCalledOnce();
    f.updates.dispose();
  });

  it("finds updates already waiting when the page mounts", async () => {
    const f = await fixture(true);
    expect(f.available).toHaveBeenCalledOnce();
    f.updates.applyUpdate();
    expect(f.worker.postMessage).toHaveBeenCalledOnce();
    f.updates.dispose();
  });

  it("removes listeners and ignores late registration after disposal", async () => {
    const f = await fixture();
    f.registration.dispatchEvent(new Event("updatefound"));
    f.updates.applyUpdate();
    f.updates.dispose();
    f.container.controller = f.worker;
    f.worker.state = "installed";
    f.worker.dispatchEvent(new Event("statechange"));
    f.container.dispatchEvent(new Event("controllerchange"));
    expect(f.reload).not.toHaveBeenCalled();
    expect(f.available).not.toHaveBeenCalled();

    let resolve!: (reg: ServiceWorkerRegistration) => void;
    f.container.register.mockReturnValue(new Promise((done) => { resolve = done; }));
    const late = observeWorkerUpdates(f.container as unknown as ServiceWorkerContainer, f.available, f.reload);
    late.dispose();
    resolve(Object.assign(f.registration, { waiting: f.worker }) as unknown as ServiceWorkerRegistration);
    await Promise.resolve();
    expect(f.available).not.toHaveBeenCalled();
  });
});
