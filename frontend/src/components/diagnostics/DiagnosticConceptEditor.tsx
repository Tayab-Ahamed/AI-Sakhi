"use client";

import { useId } from "react";
import type { DiagnosticConcept, DiagnosticStaffQuestion } from "@/lib/diagnostics";

type Props = {
  concept: DiagnosticConcept; peers: DiagnosticConcept[]; candidates: DiagnosticStaffQuestion[];
  disabled: boolean; onChange: (concept: DiagnosticConcept) => void;
};

export function DiagnosticConceptEditor({ concept, peers, candidates, disabled, onChange }: Props) {
  const prefix = useId();
  const referenced = peers.some(peer => peer !== concept && peer.prerequisite_ids.includes(concept.id));
  const usedElsewhere = new Set(peers.filter(peer => peer !== concept).flatMap(peer => peer.question_ids));
  function toggleQuestion(id: number) {
    const selected = concept.question_ids.includes(id);
    if (!selected && (concept.question_ids.length >= 3 || usedElsewhere.has(id))) return;
    onChange({ ...concept, question_ids: selected ? concept.question_ids.filter(qid => qid !== id) : [...concept.question_ids, id] });
  }
  return <fieldset className="diagnostic-concept" disabled={disabled}>
    <legend>Concept: {concept.label || "Untitled"}</legend>
    <div className="diagnostic-fields">
      <label htmlFor={`${prefix}-id`}>Concept ID
        <input id={`${prefix}-id`} value={concept.id} required maxLength={40} pattern={"[a-z][a-z0-9\\-]{0,39}"} disabled={disabled || referenced}
          aria-describedby={`${prefix}-id-help`} onChange={event => onChange({ ...concept, id: event.target.value })} />
      </label>
      <label htmlFor={`${prefix}-label`}>Concept label
        <input id={`${prefix}-label`} value={concept.label} required maxLength={80} onChange={event => onChange({ ...concept, label: event.target.value })} />
      </label>
    </div>
    <p id={`${prefix}-id-help`} className="diagnostic-hint">{referenced ? "Remove its prerequisite references before renaming this concept." : "Use a lowercase letter, then lowercase letters, digits or hyphens. IDs are local to this assessment."}</p>
    <fieldset><legend>School-defined prerequisites</legend>
      <p className="diagnostic-hint">Suggestions for what to review first, not established learning dependencies.</p>
      {peers.filter(peer => peer !== concept).map((peer, index) => <label className="diagnostic-choice" key={index}>
        <input type="checkbox" checked={concept.prerequisite_ids.includes(peer.id)} disabled={disabled || !peer.id}
          onChange={event => onChange({ ...concept, prerequisite_ids: event.target.checked ? [...concept.prerequisite_ids, peer.id] : concept.prerequisite_ids.filter(id => id !== peer.id) })} />
        Review {peer.label || peer.id || "untitled concept"} first
      </label>)}
      {peers.length < 2 && <p className="diagnostic-hint">Add another concept to select a prerequisite.</p>}
    </fieldset>
    <fieldset><legend>Approved questions — {concept.question_ids.length} of 3 selected</legend>
      <p className="diagnostic-hint">Exactly three distinct questions per concept. A question cannot be shared between concepts.</p>
      {candidates.length === 0 && <p>No eligible questions on this page. Review questions in your school bank or check the next page.</p>}
      {candidates.map(question => <label className="diagnostic-choice" key={question.id}>
        <input type="checkbox" checked={concept.question_ids.includes(question.id)}
          disabled={disabled || usedElsewhere.has(question.id) || (concept.question_ids.length >= 3 && !concept.question_ids.includes(question.id))}
          onChange={() => toggleQuestion(question.id)} />
        <span>Question {question.id}: {question.question_text}{usedElsewhere.has(question.id) ? " (selected in another concept)" : ""}</span>
      </label>)}
      {concept.question_ids.filter(id => !candidates.some(q => q.id === id)).map(id => <div key={id}>
        <p>Selected question {id} is not available on this page; check the saved preview or remove it to choose a replacement.</p>
        <button type="button" disabled={disabled} onClick={() => toggleQuestion(id)}>Remove selected question {id}</button>
      </div>)}
    </fieldset>
  </fieldset>;
}
