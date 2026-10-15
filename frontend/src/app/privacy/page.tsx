"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useRequireAuth } from "@/lib/auth";
import { useUser } from "@/lib/user-context";
import AiApprovalPanel from "@/components/AiApprovalPanel";

type Session = { id: string; created_at: string; expires_at: string; is_current: boolean };
type PrivacyRequest = { id: number; request_type: string; status: string };
const requests = [
  ["export", "Prepare account export"],
  ["delete_chat_history", "Erase server chat history"],
  ["restrict_processing", "Restrict AI processing"],
  ["delete_account", "Request account removal"],
] as const;

async function fetchControls() {
  const [active, pending] = await Promise.all([api.getSessions(), api.getPrivacyRequests()]);
  return { sessions: active.sessions as Session[], requests: pending.requests as (PrivacyRequest & { user_id: number })[] };
}

export default function PrivacyPage() {
  useRequireAuth();
  const router = useRouter();
  const { user, clearUser } = useUser();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [queue, setQueue] = useState<PrivacyRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const apply = useCallback((data: Awaited<ReturnType<typeof fetchControls>>) => {
    setSessions(data.sessions); setQueue(data.requests.filter((item) => item.user_id === user?.user_id)); setError(""); setLoading(false);
  }, [user?.user_id]);
  const failed = useCallback(() => { setError("Account controls could not load. Please try again online."); setLoading(false); }, []);
  const load = () => fetchControls().then(apply).catch(failed);
  useEffect(() => {
    if (!user?.user_id) return;
    let ignore = false;
    void fetchControls().then((data) => { if (!ignore) apply(data); }).catch(() => { if (!ignore) failed(); });
    return () => { ignore = true; };
  }, [user?.user_id, apply, failed]);

  async function request(kind: typeof requests[number][0]) {
    if (!user) return;
    if (kind.includes("delete") && !window.confirm("Submit this erasure request for school administrator review? This cannot be undone once fulfilled.")) return;
    setBusy(true);
    setError("");
    try {
      await api.requestPrivacyAction(user.user_id, kind);
      setMessage("Request submitted. Your school administrator can review it; this is not a claim that erasure is already complete.");
      await load();
    } catch { setError("Request could not be submitted. Please try again."); }
    finally { setBusy(false); }
  }

  async function revoke(session: Session) {
    setBusy(true);
    try {
      if (session.is_current) { await clearUser(); router.push("/"); }
      else { await api.revokeSession(session.id); await load(); }
    } catch { setError("Session could not be revoked. Please try again."); }
    finally { setBusy(false); }
  }

  return <main className="mx-auto max-w-3xl space-y-6 p-4 sm:p-8">
    <h1 className="text-2xl font-semibold">Privacy & account sessions</h1>
    {user && <AiApprovalPanel key={user.user_id} userId={user.user_id} role={user.role || "student"} />}
    <section className="card space-y-3 p-5" aria-labelledby="privacy-info">
      <h2 id="privacy-info" className="text-lg font-semibold">Where your learning data lives</h2>
      <p>Profile, progress, conversations, assignments and safety-event metadata can be stored on the server. Saved chats and quiz packs can also exist on this device. AI requests send learning content to the configured model provider.</p>
      <p>Signing out clears this app’s device copies. Downloaded backups remain under your control. Server erasure requires administrator review; backup expiry must be verified separately.</p>
      <p>Do not upload private identification or health information. Safeguarding reports are minimized; this app does not automatically contact an adult or emergency service.</p>
    </section>
    {error && <p role="alert">{error} <button type="button" className="landing-button landing-button-secondary" onClick={() => void load()}>Retry</button></p>}
    {message && <p role="status">{message}</p>}
    <section className="card space-y-4 p-5" aria-labelledby="data-controls" aria-busy={busy}>
      <h2 id="data-controls" className="text-lg font-semibold">Server data requests</h2>
      <div className="flex flex-wrap gap-3">{requests.map(([kind, label]) => <button key={kind} disabled={!user || busy} type="button" className="landing-button landing-button-secondary" onClick={() => void request(kind)}>{label}</button>)}</div>
      {loading ? <p role="status">Loading requests…</p> : queue.length === 0 ? <p>No requests submitted yet.</p> : <ul className="space-y-2">{queue.map((item) => <li key={item.id}>{item.request_type.replaceAll("_", " ")} — {item.status.replaceAll("_", " ")}</li>)}</ul>}
    </section>
    <section className="card space-y-4 p-5" aria-labelledby="session-controls">
      <h2 id="session-controls" className="text-lg font-semibold">Active sessions</h2>
      {loading ? <p role="status">Loading sessions…</p> : sessions.length === 0 ? <p>No active sessions found.</p> : <ul className="space-y-3">{sessions.map((session) => <li key={session.id} className="flex flex-wrap items-center justify-between gap-3"><span>{session.is_current ? "This session" : "Another session"} · expires {new Date(session.expires_at).toLocaleDateString()}</span><button type="button" disabled={busy} className="landing-button landing-button-secondary" onClick={() => void revoke(session)}>Sign out {session.is_current ? "here" : "session"}</button></li>)}</ul>}
    </section>
  </main>;
}
