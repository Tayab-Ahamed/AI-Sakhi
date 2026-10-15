"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { api, ApiError } from "@/lib/api";
import { clearDiagnosticResume, readDiagnosticResume, saveDiagnosticResume } from "@/lib/diagnostic-resume";
import type { DiagnosticAnswers, DiagnosticAttempt, DiagnosticIdentity, DiagnosticList, DiagnosticStart } from "@/lib/diagnostics";

function subscribeOnline(change: () => void) { window.addEventListener("online", change); window.addEventListener("offline", change); return () => { window.removeEventListener("online", change); window.removeEventListener("offline", change); }; }
export function useDiagnosticAssessment(identity: DiagnosticIdentity) {
  const scope = useMemo(() => ({ user_id: identity.user_id, organization_id: identity.organization_id, class_: identity.class_ }), [identity.user_id, identity.organization_id, identity.class_]);
  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
  const [list, setList] = useState<DiagnosticList>({ blueprints: [], next_after_id: null });
  const [attempt, setAttempt] = useState<DiagnosticAttempt | null>(null);
  const [answers, setAnswers] = useState<DiagnosticAnswers>({});
  const [frozen, setFrozen] = useState<DiagnosticAnswers | null>(null);
  const [starting, setStarting] = useState(false);
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false);
  const [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [blocked, setBlocked] = useState(false), [unauthorized, setUnauthorized] = useState(false);
  const [canResume, setCanResume] = useState(false);
  const alive = useRef(false), mutex = useRef(false);
  const startIntent = useRef<DiagnosticStart | null>(null);
  const resumeId = useRef<string | null>(null);
  useEffect(() => {
    alive.current = true;
    const saved = readDiagnosticResume(scope); resumeId.current = saved;
    function failed(err: unknown) {
      if (!alive.current) return;
      if (err instanceof ApiError && [401, 403, 404, 409].includes(err.status)) {
        clearDiagnosticResume(scope); resumeId.current = null; setCanResume(false); setBlocked(true);
        setUnauthorized([401, 403].includes(err.status)); setError(err.message);
      } else { setCanResume(!!saved); setError(saved ? "Could not resume the assessment. Reconnect and retry resume; no unsent choices were stored." : "Could not load assessments. Reconnect and reload."); }
    }
    const request = saved ? api.getDiagnosticAttempt(saved).then(value => {
      if (!alive.current) return;
      setAttempt(value); setCanResume(true); setNotice(value.status === "completed" ? "Stored completed result restored from the school server." : "Resumed online. Unsent choices are not restored after a reload; select an answer or skip again.");
    }) : api.listDiagnosticBlueprints({ limit: 20 }).then(value => { if (alive.current) setList(value); });
    request.catch(failed).finally(() => { if (alive.current) setLoading(false); });
    return () => { alive.current = false; };
  }, [scope]);
  function apply(value: DiagnosticAttempt) {
    if (!alive.current) return;
    setAttempt(value); resumeId.current = value.id; setCanResume(true); saveDiagnosticResume(scope, value.id);
    if (value.status === "completed") { setFrozen(null); setAnswers({}); }
  }
  async function run(operation: () => Promise<void>, fallback: string) {
    if (mutex.current || !online) return;
    mutex.current = true; setBusy(true); setError(""); setNotice("");
    try { await operation(); }
    catch (err) {
      if (!alive.current) return;
      if (err instanceof ApiError && [401, 403, 404, 409].includes(err.status)) {
        clearDiagnosticResume(scope); resumeId.current = null; setCanResume(false); setAttempt(null); setFrozen(null);
        startIntent.current = null; setStarting(false); setBlocked(true); setUnauthorized([401, 403].includes(err.status));
      }
      setError(err instanceof ApiError ? err.message : fallback);
    } finally { mutex.current = false; if (alive.current) setBusy(false); }
  }
  const loadList = (after_id = 0, reset = false) => run(async () => {
    if (reset) {
      clearDiagnosticResume(scope); resumeId.current = null; setCanResume(false); setAttempt(null); setAnswers({}); setFrozen(null);
      startIntent.current = null; setStarting(false); setBlocked(false); setUnauthorized(false);
    }
    const value = await api.listDiagnosticBlueprints({ after_id, limit: 20 });
    if (alive.current) setList(previous => ({ ...value, blueprints: after_id ? [...previous.blueprints, ...value.blueprints] : value.blueprints }));
  }, "Could not load assessments. Reconnect and reload.");
  const start = (versionId?: number) => run(async () => {
    if (!startIntent.current && versionId !== undefined) startIntent.current = { creation_key: crypto.randomUUID(), version_id: versionId };
    if (!startIntent.current) return;
    setStarting(true);
    try {
      const value = await api.startDiagnostic(startIntent.current);
      if (!alive.current) return;
      apply(value); startIntent.current = null; setStarting(false); setAnswers({}); setFrozen(null);
    } catch (err) {
      if (err instanceof ApiError && err.status < 500) { startIntent.current = null; if (alive.current) setStarting(false); }
      throw err;
    }
  }, "Start delivery is uncertain. Retry start assessment using the same displayed-version intent.");
  const resume = () => run(async () => {
    if (!resumeId.current) return;
    const value = await api.getDiagnosticAttempt(resumeId.current);
    apply(value);
    if (alive.current) setNotice(value.status === "completed" ? "Stored completed result restored from the school server." : "Resumed online. Unsent choices are not restored after a reload.");
  }, "Could not resume the assessment. Reconnect and retry resume.");
  const submit = () => run(async () => {
    if (!attempt) return;
    const payload = frozen ?? Object.freeze({ ...answers }); setFrozen(payload);
    try { apply(await api.submitDiagnostic(attempt.id, payload)); }
    catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        const stored = await api.getDiagnosticAttempt(attempt.id);
        if (!alive.current) return;
        if (stored.status === "completed") {
          apply(stored); setNotice("The server already stored different answers. Showing its authoritative completed result; your draft answers were not saved."); return;
        }
      }
      if (err instanceof ApiError && err.status === 422 && alive.current) setFrozen(null);
      throw err;
    }
  }, "Submission delivery is uncertain. Your submitted selections are frozen. Reconnect and retry the identical submission or load server status.");
  return { list, attempt, answers, frozen, starting, loading, busy, error, notice, blocked, unauthorized, online,
    start, resume, submit, loadList, canResume,
    choose: (id: number, answer: number | null) => { if (!busy && !frozen) setAnswers(previous => ({ ...previous, [id]: answer })); },
  };
}
