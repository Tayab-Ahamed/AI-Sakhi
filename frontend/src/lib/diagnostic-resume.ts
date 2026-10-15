import type { DiagnosticIdentity } from "./diagnostics";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function key(identity: DiagnosticIdentity): string | null {
  if (!Number.isSafeInteger(identity.user_id) || identity.user_id < 1 ||
      !Number.isSafeInteger(identity.organization_id) || identity.organization_id < 1 ||
      !identity.class_ || identity.class_.length > 20) return null;
  return `sakhi_diagnostic_attempt:${identity.organization_id}:${identity.user_id}:${encodeURIComponent(identity.class_)}`;
}

/** Reference only: server authorization must precede showing any content. No unsent answers. */
export function saveDiagnosticResume(identity: DiagnosticIdentity, attemptId: string): void {
  try { const scope = key(identity); if (scope && UUID.test(attemptId)) localStorage.setItem(scope, attemptId); } catch { /* Storage is optional. */ }
}
export function readDiagnosticResume(identity: DiagnosticIdentity): string | null {
  try {
    const scope = key(identity);
    if (!scope) return null;
    const attemptId = localStorage.getItem(scope);
    if (attemptId && UUID.test(attemptId)) return attemptId;
    if (attemptId) localStorage.removeItem(scope);
  } catch { /* Blocked storage never grants access. */ }
  return null;
}
export function clearDiagnosticResume(identity: DiagnosticIdentity): void {
  try { const scope = key(identity); if (scope) localStorage.removeItem(scope); } catch { /* Storage is optional. */ }
}
