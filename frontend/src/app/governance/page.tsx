"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useRequireAuth } from "@/lib/auth";
import { useUser } from "@/lib/user-context";
import LearnerApprovalRoster from "@/components/LearnerApprovalRoster";

type SafetyEvent = { id: number; user_id: number; category: string; severity: string; status: string };
type PrivacyRequest = { id: number; user_id: number; request_type: string; status: string };

async function fetchQueues(admin: boolean) {
  const [safety, privacy] = await Promise.all([api.getSafetyEvents(), admin ? api.getPrivacyRequests() : Promise.resolve({ requests: [] })]);
  return { events: safety.events as SafetyEvent[], requests: privacy.requests as PrivacyRequest[] };
}

export default function GovernancePage() {
  useRequireAuth(["teacher", "admin"]);
  const { user } = useUser();
  const [events, setEvents] = useState<SafetyEvent[]>([]);
  const [requests, setRequests] = useState<PrivacyRequest[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const apply = useCallback((data: Awaited<ReturnType<typeof fetchQueues>>) => {
    setEvents(data.events); setRequests(data.requests); setError(""); setLoading(false);
  }, []);
  const failed = useCallback(() => { setError("Review queues could not load. Please try again online."); setLoading(false); }, []);
  const load = () => fetchQueues(user?.role === "admin").then(apply).catch(failed);
  useEffect(() => {
    if (user?.role !== "teacher" && user?.role !== "admin") return;
    let ignore = false;
    void fetchQueues(user.role === "admin").then((data) => { if (!ignore) apply(data); }).catch(() => { if (!ignore) failed(); });
    return () => { ignore = true; };
  }, [user?.role, apply, failed]);

  async function review(id: number, privacy = false) {
    if (privacy && !window.confirm("Apply this privacy request to active server data? Erasure cannot be undone. Backups still require separate expiry verification.")) return;
    setBusy(true);
    try {
      if (privacy) {
        const result = await api.fulfilPrivacyRequest(id);
        if (result.export) {
          const url = URL.createObjectURL(new Blob([JSON.stringify(result.export, null, 2)], { type: "application/json" }));
          const link = document.createElement("a"); link.href = url; link.download = `account-export-${id}.json`; link.click(); URL.revokeObjectURL(url);
        }
      } else await api.acknowledgeSafetyEvent(id);
      await load();
    } catch { setError("Review could not be applied. Refresh the queue before trying again."); }
    finally { setBusy(false); }
  }

  return <main className="mx-auto max-w-4xl space-y-6 p-4 sm:p-8">
    <h1 className="text-2xl font-semibold">School governance review</h1>
    {user && <LearnerApprovalRoster key={`${user.user_id}:${user.organization_id}`} actorId={user.user_id} actorRole={user.role || ""} organizationId={user.organization_id} />}
    <p>Acknowledgement records review, not resolution. Follow your school’s safeguarding protocol. No emergency notification is sent by this app.</p>
    {error && <p role="alert">{error} <button type="button" className="landing-button landing-button-secondary" onClick={() => void load()}>Refresh</button></p>}
    {loading && <p role="status">Loading school-scoped queues…</p>}
    <section className="card space-y-4 p-5" aria-labelledby="safety-queue" aria-busy={busy}>
      <h2 id="safety-queue" className="text-lg font-semibold">Safeguarding</h2>
      {!loading && events.length === 0 && <p>No safety events for your school.</p>}
      <ul className="space-y-4">{events.map((event) => <li key={event.id} className="flex flex-wrap justify-between gap-3"><span>Learner #{event.user_id}: {event.category} · {event.severity} · {event.status}</span><button type="button" disabled={busy || event.status === "acknowledged"} className="landing-button landing-button-secondary" onClick={() => void review(event.id)}>Acknowledge event #{event.id}</button></li>)}</ul>
    </section>
    {user?.role === "admin" && <section className="card space-y-4 p-5" aria-labelledby="privacy-queue">
      <h2 id="privacy-queue" className="text-lg font-semibold">Privacy requests</h2>
      {!loading && requests.length === 0 && <p>No privacy requests for your school.</p>}
      <ul className="space-y-4">{requests.map((request) => <li key={request.id} className="flex flex-wrap justify-between gap-3"><span>Account #{request.user_id}: {request.request_type.replaceAll("_", " ")} · {request.status.replaceAll("_", " ")}</span><button type="button" disabled={busy || request.status !== "pending"} className="landing-button landing-button-secondary" onClick={() => void review(request.id, true)}>Apply request #{request.id}</button></li>)}</ul>
    </section>}
  </main>;
}
