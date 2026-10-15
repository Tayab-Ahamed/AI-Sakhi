"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { clearDiagnosticResume } from "@/lib/diagnostic-resume";
import type { DiagnosticIdentity } from "@/lib/diagnostics";
import { DiagnosticResult } from "./DiagnosticResult";
import { useDiagnosticAssessment } from "./use-diagnostic-assessment";

export function DiagnosticAssessment({ identity }: { identity: DiagnosticIdentity }) {
  const previous = useRef(identity);
  useEffect(() => {
    if (previous.current.user_id !== identity.user_id || previous.current.organization_id !== identity.organization_id || previous.current.class_ !== identity.class_) clearDiagnosticResume(previous.current);
    previous.current = identity;
  }, [identity]);
  return <AssessmentSession key={`${identity.organization_id}:${identity.user_id}:${identity.class_}`} identity={identity} />;
}
function AssessmentSession({ identity }: { identity: DiagnosticIdentity }) {
  const state = useDiagnosticAssessment(identity);
  const { attempt, busy, loading, online, frozen } = state;
  const questions = attempt?.concepts.flatMap(c => c.questions) ?? [];
  const ready = questions.length > 0 && questions.every(question => Object.hasOwn(state.answers, String(question.id)));
  return <div className="diagnostic-workspace">
    {!online && <p role="status" className="diagnostic-notice">Offline: reconnect to use diagnostics. Questions, results and submissions are not cached or queued offline.</p>}
    {state.error && <p role="alert" className="diagnostic-error">{state.error}</p>}
    {state.notice && <p role="status">{state.notice}</p>}
    {(loading || busy) && <p role="status">{loading ? "Loading school diagnostics…" : "Working with the school server…"}</p>}
    {state.unauthorized ? <Link className="diagnostic-link" href="/login">Sign in again</Link> : state.blocked ?
      <button type="button" disabled={busy || !online} onClick={() => void state.loadList(0, true)}>Return to assessments</button> : !loading && <>
      {attempt?.status === "completed" && attempt.result ? <DiagnosticResult result={attempt.result} concepts={attempt.concepts} /> : attempt ? <form onSubmit={event => { event.preventDefault(); if (ready) void state.submit(); }} aria-labelledby="diagnostic-active-title" aria-busy={busy}>
        <h2 id="diagnostic-active-title">{attempt.title}</h2>
        <p>Class {attempt.class_level} · {attempt.subject} · {questions.length} questions</p>
        <p>This is tentative evidence, not proof of mastery. Choose an answer or explicitly select “I&apos;m not sure” for every question. Unsent choices stay in this page only.</p>
        {attempt.concepts.map(concept => <section aria-labelledby={`diagnostic-concept-${concept.id}`} key={concept.id}>
          <h3 id={`diagnostic-concept-${concept.id}`}>{concept.label}</h3>
          {concept.questions.map(question => <fieldset className="diagnostic-question" key={question.id} disabled={busy || !!frozen || !online}>
            <legend>{question.question_text}</legend>
            {question.options.map((option, index) => <label className="diagnostic-choice" key={index}>
              <input type="radio" name={`diagnostic-${question.id}`} checked={state.answers[String(question.id)] === index} onChange={() => state.choose(question.id, index)} />{option}
            </label>)}
            <label className="diagnostic-choice"><input type="radio" name={`diagnostic-${question.id}`}
              checked={Object.hasOwn(state.answers, String(question.id)) && state.answers[String(question.id)] === null} onChange={() => state.choose(question.id, null)} />I&apos;m not sure</label>
          </fieldset>)}
        </section>)}
        <p>{Object.keys(state.answers).length} of {questions.length} questions answered or explicitly skipped.</p>
        <button type="submit" disabled={busy || !online || (!ready && !frozen)}>{frozen ? "Retry identical submission" : "Submit assessment"}</button>
      </form> : <section aria-labelledby="diagnostic-available">
        <h2 id="diagnostic-available">Available assessments</h2>
        <p>A short assessment gives tentative evidence, not proof of mastery. A repeat may reuse the same questions and is not independent evidence of improvement.</p>
        {!state.error && state.list.blueprints.length === 0 && <p>Your school has not published an assessment for your current class. School practice remains available independently.</p>}
        <ul className="diagnostic-list">{state.list.blueprints.map(card => <li key={card.id}>
          <div><h3>{card.title}</h3><p>{card.subject} · Class {card.class_level} · {card.concept_count} concepts · {card.question_count} questions</p></div>
          <button type="button" disabled={busy || !online || state.starting || !card.latest_version} onClick={() => void state.start(card.latest_version!.id)}>Start {card.title}</button>
        </li>)}</ul>
        <div className="diagnostic-actions">
          {state.starting && <button type="button" disabled={busy || !online} onClick={() => void state.start()}>Retry start assessment</button>}
          {state.canResume && <button type="button" disabled={busy || !online} onClick={() => void state.resume()}>Retry resume</button>}
          <button type="button" disabled={busy || !online || state.starting} onClick={() => void state.loadList()}>Reload assessments</button>
          {state.list.next_after_id !== null && <button type="button" disabled={busy || !online || state.starting} onClick={() => void state.loadList(state.list.next_after_id!)}>More assessments</button>}
        </div>
      </section>}
      {(attempt || state.starting) && <div className="diagnostic-actions">
        {frozen && <button type="button" disabled={busy || !online} onClick={() => void state.resume()}>Load server status</button>}
        <button type="button" disabled={busy || !online} onClick={() => void state.loadList(0, true)}>Start a new attempt</button>
      </div>}
    </>}
  </div>;
}
