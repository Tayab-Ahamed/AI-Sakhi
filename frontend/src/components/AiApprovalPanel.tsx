"use client";

import { useEffect, useId, useState } from "react";
import { api } from "@/lib/api";

export type ApprovalState = {
  approved: boolean;
  processing_restricted: boolean;
  ai_allowed: boolean;
  policy: {
    configured: boolean;
    enforced: boolean;
    approval_mode: string;
    policy_version: string;
    chat_retention_days: number | null;
    sharing_notice: string;
    limitations: string;
  };
};

type ApprovalProps = { userId: number; role: string; actorRole?: string; subjectName?: string };

export default function AiApprovalPanel(props: ApprovalProps) {
  // Never carry a policy, pending decision or acknowledgement across subjects.
  return <ApprovalForSubject key={`${props.userId}:${props.role}:${props.actorRole || "self"}`} {...props} />;
}

function ApprovalForSubject({ userId, role, actorRole, subjectName }: ApprovalProps) {
  const headingId = useId();
  const [state, setState] = useState<ApprovalState | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [reload, setReload] = useState(0);
  const actingForLearner = actorRole !== undefined;
  const canApprove = actingForLearner
    ? (state?.policy.approval_mode === "guardian" && actorRole === "parent") || (state?.policy.approval_mode === "school" && ["teacher", "admin"].includes(actorRole || ""))
    : role !== "student";
  const canWithdraw = canApprove || (!actingForLearner && role === "student");
  useEffect(() => {
    let ignore = false;
    void api.getAiApproval(userId).then((data) => {
      if (!ignore) { setState(data as unknown as ApprovalState); setAcknowledged(false); setError(""); }
    }).catch(() => { if (!ignore) setError("AI approval status could not load. Try again online."); });
    return () => { ignore = true; };
  }, [userId, reload]);

  async function decide(granted: boolean) {
    if (!state) return;
    setBusy(true); setError("");
    try {
      const result = await api.decideAiApproval(userId, granted, state.policy.policy_version);
      setState(result as unknown as ApprovalState); setAcknowledged(false);
    } catch { setError("Approval could not be saved. Reload the status if the policy changed."); }
    finally { setBusy(false); }
  }

  return <section className="card space-y-3 p-5" aria-labelledby={headingId} aria-busy={busy}>
    <h2 id={headingId} className="text-lg font-semibold">AI processing approval{subjectName ? ` — ${subjectName}` : ""}</h2>
    {error && <p role="alert">{error} <button type="button" className="landing-button landing-button-secondary" disabled={busy} onClick={() => { setState(null); setReload((value) => value + 1); }}>Reload approval status</button></p>}
    {!state && !error && <p role="status">Loading AI approval…</p>}
    {state && <>
      <p>{state.policy.sharing_notice}</p>
      <p>{state.policy.limitations}</p>
      <p>Chat retention: {state.policy.chat_retention_days ? `${state.policy.chat_retention_days} days proposed` : "not configured"}. Automatic deletion is disabled.</p>
      <p role="status">{state.processing_restricted ? "AI processing is restricted for this account." : state.approved ? "Current policy approved." : state.policy.configured ? "Current approval is required." : "Approval policy has not been configured."}</p>
      {!state.policy.enforced && <p>Development mode does not enforce approval. This is not approval for a production rollout.</p>}
      {state.policy.configured && <>
        <p>Policy version: {state.policy.policy_version}</p>
        {!actingForLearner && role === "student" && <p>Approval must come from {state.policy.approval_mode === "guardian" ? "your linked parent" : "your school staff"}. You can withdraw an existing approval here.</p>}
        {actingForLearner && !canApprove && <p>The selected policy does not authorize your role to approve this learner.</p>}
        {canApprove && !state.approved && <>
          <label className="flex items-start gap-3"><input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} />{actingForLearner ? "I acknowledge the sharing notice and my authority for this learner." : "I acknowledge the AI sharing notice for my own account."}</label>
          <button type="button" className="landing-button landing-button-secondary" disabled={busy || !acknowledged || state.processing_restricted} onClick={() => void decide(true)}>{actingForLearner ? "Approve learner AI processing" : "Approve my AI processing"}</button>
        </>}
        {state.approved && canWithdraw && <button type="button" className="landing-button landing-button-secondary" disabled={busy} onClick={() => void decide(false)}>Withdraw AI approval</button>}
        <p>Withdrawal blocks new AI requests. It does not cancel requests already in flight or erase existing records; use the privacy page for data requests.</p>
      </>}
    </>}
  </section>;
}
