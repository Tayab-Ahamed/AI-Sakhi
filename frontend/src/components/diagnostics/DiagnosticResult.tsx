"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import type { DiagnosticAttempt, DiagnosticEvidenceState, DiagnosticResult as DiagnosticEvidenceResult } from "@/lib/diagnostics";

const states: Record<DiagnosticEvidenceState, { title: string; description: string }> = {
  insufficient_evidence: { title: "Insufficient evidence", description: "Answer more reviewed questions before drawing a conclusion." },
  review_suggested: { title: "Review suggested", description: "These answers suggest revisiting this concept. This is tentative evidence." },
  provisional_strength: { title: "Provisional strength", description: "Encouraging evidence in this short attempt, not confirmed mastery." },
};
const actions = { collect_evidence: "Collect more evidence", review: "Review this concept", spaced_practice: "Spaced practice" };

export function DiagnosticResult({ result, concepts }: { result: DiagnosticEvidenceResult; concepts: DiagnosticAttempt["concepts"] }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, []);
  const questions = new Map(concepts.flatMap(c => c.questions).map(q => [q.id, q]));
  return <section className="diagnostic-result" aria-labelledby="diagnostic-result-heading">
    <h2 ref={heading} id="diagnostic-result-heading" tabIndex={-1} aria-describedby="diagnostic-limitations">Diagnostic evidence</h2>
    <p className="diagnostic-summary">{result.correct_count} correct · {result.answered_count} answered · {result.skipped_count} skipped · {result.question_count} questions</p>
    <p id="diagnostic-limitations" className="diagnostic-notice">{result.limitations}</p>
    <p>Skips are not counted incorrect. Prerequisite relationships are school-defined review suggestions; they do not restrict what you may learn.</p>
    <div className="diagnostic-evidence-grid">{result.concept_results.map(concept => <article className="diagnostic-evidence" key={concept.id}>
      <h3>{concept.label}</h3><p className={`diagnostic-state diagnostic-state-${concept.state}`}>{states[concept.state].title}</p>
      <p>{states[concept.state].description}</p>
      <p>{concept.correct_count} correct / {concept.answered_count} answered · {concept.question_count} assigned · Skipped: {concept.skipped_count}</p>
      <div role="group" aria-label="Prerequisites suggesting review"><h4>Prerequisites suggesting review</h4>
        {concept.review_prerequisites.length ? <ul>{concept.review_prerequisites.map(item => <li key={item.id}>{item.label}</li>)}</ul> : <p>No ancestor prerequisites with review suggested.</p>}
      </div>
      <div role="group" aria-label="Prerequisites needing more evidence"><h4>Prerequisites needing more evidence</h4>
        {concept.unassessed_prerequisites.length ? <ul>{concept.unassessed_prerequisites.map(item => <li key={item.id}>{item.label}</li>)}</ul> : <p>No ancestor prerequisites awaiting evidence.</p>}
      </div>
    </article>)}</div>
    <section aria-labelledby="diagnostic-next"><h3 id="diagnostic-next">Suggested next step</h3>
      <p>{actions[result.next_action.kind]}</p><p>{result.next_action.reason}</p>
      <Link className="diagnostic-link" href={result.next_action.href}>Open school practice</Link>
    </section>
    <section aria-labelledby="diagnostic-feedback"><h3 id="diagnostic-feedback">Reviewed question feedback</h3>
      {result.items.map((item, index) => {
        const question = questions.get(item.question_id);
        return <article className="diagnostic-feedback-item" key={item.question_id}>
          <h4>Question {index + 1}: {item.is_skipped ? "Skipped — not counted incorrect" : item.is_correct ? "Correct" : "Review this answer"}</h4>
          {question && <p>{question.question_text}</p>}
          <p>Your answer: {item.selected_index === null ? "Skipped" : question?.options[item.selected_index] ?? "Unavailable"}</p>
          <p>Reviewed answer: {question?.options[item.correct_index] ?? "Unavailable"}</p>
          <p>{item.explanation || "No teacher explanation provided."}</p>
        </article>;
      })}
    </section>
  </section>;
}
