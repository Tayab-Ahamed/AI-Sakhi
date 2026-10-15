/** A worker taking control must never discard unsaved input without consent. */
export function observeWorkerUpdates(
  container: ServiceWorkerContainer,
  onAvailable: () => void,
  reload: () => void,
) {
  let disposed = false;
  let refreshRequested = false;
  let waitingWorker: ServiceWorker | null = null;
  const watched = new Set<ServiceWorker>();
  const cleanups: (() => void)[] = [];
  const controllerChanged = () => {
    if (disposed || !refreshRequested) return;
    refreshRequested = false;
    reload();
  };
  container.addEventListener("controllerchange", controllerChanged);
  cleanups.push(() => container.removeEventListener("controllerchange", controllerChanged));

  void container.register("/sw.js", { scope: "/" }).then((registration) => {
    if (disposed) return;
    if (registration.waiting) {
      waitingWorker = registration.waiting;
      onAvailable();
    }
    const watchInstalling = () => {
      const worker = registration.installing;
      if (!worker || watched.has(worker)) return;
      watched.add(worker);
      const stateChanged = () => {
        if (!disposed && worker.state === "installed" && container.controller) {
          waitingWorker = worker;
          onAvailable();
        }
      };
      worker.addEventListener("statechange", stateChanged);
      cleanups.push(() => worker.removeEventListener("statechange", stateChanged));
      stateChanged();
    };
    registration.addEventListener("updatefound", watchInstalling);
    cleanups.push(() => registration.removeEventListener("updatefound", watchInstalling));
    watchInstalling();
  }).catch(() => { /* App remains usable when worker registration is unavailable. */ });

  return {
    applyUpdate() {
      if (disposed || !waitingWorker) return;
      refreshRequested = true;
      waitingWorker.postMessage({ type: "SKIP_WAITING" });
    },
    dispose() {
      disposed = true;
      refreshRequested = false;
      cleanups.forEach((cleanup) => cleanup());
      waitingWorker = null;
      watched.clear();
    },
  };
}
