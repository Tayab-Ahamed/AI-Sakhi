"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import AiApprovalPanel from "./AiApprovalPanel";

export default function LearnerApprovalRoster({ actorId, actorRole, organizationId }: { actorId: number; actorRole: string; organizationId?: number | null }) {
  const [learners, setLearners] = useState<Array<{ id: number; name: string }>>([]);
  const [selected, setSelected] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let ignore = false;
    const request = actorRole === "parent" ? api.getChildren(actorId) : organizationId ? api.getOrganizationRoster(organizationId) : Promise.reject(new Error("School unavailable"));
    void request.then((data) => {
      if (ignore) return;
      const rows = (actorRole === "parent" ? data.children : data.roster) as Array<{ id?: number; user_id?: number; name: string }>;
      const items = (rows || []).map((row) => ({ id: Number(row.id || row.user_id), name: row.name })).filter((row) => row.id > 0);
      setLearners(items); setSelected(items[0]?.id || 0); setLoading(false); setError("");
    }).catch(() => { if (!ignore) { setError("Authorized learners could not load. Try again online."); setLoading(false); } });
    return () => { ignore = true; };
  }, [actorId, actorRole, organizationId, reload]);
  return <section className="space-y-4" aria-label="Learner AI approvals">
    <h2 className="text-lg font-semibold">Learner approvals</h2>
    {loading && <p role="status">Loading authorized learners…</p>}
    {error && <p role="alert">{error} <button type="button" className="landing-button landing-button-secondary" onClick={() => setReload((value) => value + 1)}>Reload learners</button></p>}
    {!loading && !error && learners.length === 0 && <p>No authorized learners found. Ask the school administrator to verify links or the roster.</p>}
    {!error && learners.length > 0 && <>
      <label className="flex flex-col gap-2">Learner<select className="input" value={selected} onChange={(event) => setSelected(Number(event.target.value))}>{learners.map((learner) => <option key={learner.id} value={learner.id}>{learner.name}</option>)}</select></label>
      <AiApprovalPanel key={`${actorId}:${actorRole}:${selected}`} userId={selected} role="student" actorRole={actorRole} subjectName={learners.find((item) => item.id === selected)?.name} />
    </>}
  </section>;
}
