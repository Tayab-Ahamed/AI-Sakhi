"use client";

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { clearDiagnosticResume } from "./diagnostic-resume";
import type { DiagnosticIdentity } from "./diagnostics";

/** A render-safe expiry gate; authentication and resource authority remain server-owned. */
export function useDiagnosticSessionCurrent(expiresAt: string | undefined, identity?: DiagnosticIdentity): boolean {
  const snapshot = useCallback(() => !!expiresAt && new Date(expiresAt).getTime() > Date.now(), [expiresAt]);
  const subscribe = useCallback((change: () => void) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      change();
      const remaining = expiresAt ? new Date(expiresAt).getTime() - Date.now() : 0;
      if (remaining > 0) timer = setTimeout(schedule, Math.min(remaining + 1, 2_147_483_647));
    };
    const remaining = expiresAt ? new Date(expiresAt).getTime() - Date.now() : 0;
    if (remaining > 0) timer = setTimeout(schedule, Math.min(remaining + 1, 2_147_483_647));
    window.addEventListener("focus", change);
    return () => { clearTimeout(timer); window.removeEventListener("focus", change); };
  }, [expiresAt]);
  const current = useSyncExternalStore(subscribe, snapshot, () => false);
  const previous = useRef(identity);
  useEffect(() => {
    const old = previous.current;
    if (old && (!identity || old.user_id !== identity.user_id || old.organization_id !== identity.organization_id || old.class_ !== identity.class_ || !expiresAt || !(new Date(expiresAt).getTime() > Date.now()))) clearDiagnosticResume(old);
    previous.current = identity;
  }, [identity, expiresAt, current]);
  return current;
}
