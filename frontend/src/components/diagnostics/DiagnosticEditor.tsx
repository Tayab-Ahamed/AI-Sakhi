"use client";

import { useRef } from "react";
import Link from "next/link";
import type { DiagnosticIdentity } from "@/lib/diagnostics";
import { DiagnosticConceptEditor } from "./DiagnosticConceptEditor";
import { useDiagnosticEditor } from "./use-diagnostic-editor";

export function DiagnosticEditor({ identity }: { identity: DiagnosticIdentity }) {
  return <EditorSession key={`${identity.organization_id}:${identity.user_id}:${identity.class_}`} identity={identity} />;
}
function EditorSession({ identity }: { identity: DiagnosticIdentity }) {
  const editor = useDiagnosticEditor(identity);
  const form = useRef<HTMLFormElement>(null);
  const { definition, setDefinition, blueprint, busy, creating, publishing } = editor;
  const locked = busy || creating || publishing;
  const complete = definition.concepts.length > 0 && definition.concepts.every(c => c.question_ids.length === 3);
  function valid(action: () => void) { if (form.current?.reportValidity()) action(); }
  function addConcept() {
    const used = new Set(definition.concepts.map(c => c.id));
    let index = 1; while (used.has(`concept-${index}`)) index++;
    setDefinition({ ...definition, concepts: [...definition.concepts, { id: `concept-${index}`, label: `New concept ${index}`, prerequisite_ids: [], question_ids: [] }] });
  }
  if (editor.unauthorized) return <div className="diagnostic-workspace">
    <p role="alert" className="diagnostic-error">{editor.error}</p>
    <Link className="diagnostic-link" href="/login">Sign in again</Link>
  </div>;
  return <div className="diagnostic-workspace">
    <section aria-labelledby="diagnostic-assessments">
      <h2 id="diagnostic-assessments">Your school&apos;s assessments</h2>
      {editor.loading && <p role="status">Loading school assessments…</p>}
      {!editor.loading && editor.list.blueprints.length === 0 && <p>No assessments yet. Create a draft using your school&apos;s reviewed content.</p>}
      <ul className="diagnostic-list">{editor.list.blueprints.map(card => <li key={card.id}>
        <span>{card.title} · Class {card.class_level} · {card.subject}</span>
        <button type="button" disabled={locked} onClick={() => void editor.open(card.id)}>Edit {card.title}</button>
      </li>)}</ul>
      <div className="diagnostic-actions">
        <button type="button" disabled={locked} onClick={() => void editor.loadList()}>Reload assessment list</button>
        {editor.list.next_after_id !== null && <button type="button" disabled={locked} onClick={() => void editor.loadList(editor.list.next_after_id!)}>More assessments</button>}
      </div>
    </section>
    {editor.error && <p role="alert" className="diagnostic-error">{editor.error} Local edits remain here unless you choose to reload.</p>}
    {editor.notice && <p role="status">{editor.notice}</p>}
    {busy && <p role="status">Working with the school server…</p>}
    <form ref={form} onSubmit={event => event.preventDefault()} aria-labelledby="diagnostic-setup" aria-busy={busy}>
      <h2 id="diagnostic-setup">Assessment setup</h2>
      <p>School-curated evidence, not a validated diagnosis. Publish 1–6 concepts with exactly three approved questions each. Subject must match your bank exactly.</p>
      <div className="diagnostic-fields">{([
        ["title", "Assessment title", 120], ["class_level", "Class", 20], ["subject", "Subject", 100],
      ] as const).map(([key, label, max]) => <label key={key}>{label}
        <input required maxLength={max} value={definition[key]} disabled={locked}
          onChange={event => setDefinition({ ...definition, [key]: event.target.value })} />
      </label>)}</div>
      <div className="diagnostic-actions">
        {!blueprint && <button type="button" disabled={busy} onClick={() => valid(() => void editor.create())}>{creating ? "Retry create draft" : "Create draft"}</button>}
        {blueprint && <button type="button" disabled={locked} onClick={() => valid(() => void editor.save())}>Save draft</button>}
        <button type="button" disabled={busy} onClick={editor.newDraft}>Start a different draft</button>
        {blueprint && <button type="button" disabled={busy} onClick={() => void editor.open(blueprint.id)}>Reload saved draft</button>}
      </div>
      {blueprint && <>
        <p>Saved draft revision {blueprint.draft_revision}. Changes are not published until you explicitly publish.</p>
        {definition.concepts.map((concept, index) => <div key={index}>
          <DiagnosticConceptEditor concept={concept} peers={definition.concepts} candidates={editor.candidates} disabled={locked}
            onChange={value => setDefinition({ ...definition, concepts: definition.concepts.map((c, i) => i === index ? value : c) })} />
          <button type="button" disabled={locked || definition.concepts.some(c => c.prerequisite_ids.includes(concept.id))}
            onClick={() => setDefinition({ ...definition, concepts: definition.concepts.filter((_, i) => i !== index) })}>Remove {concept.label || "concept"}</button>
        </div>)}
        <div className="diagnostic-actions">
          <button type="button" disabled={locked || definition.concepts.length >= 6} onClick={addConcept}>Add concept</button>
          <button type="button" disabled={locked} onClick={() => void editor.firstCandidates()}>First question page</button>
          <button type="button" disabled={locked || editor.nextQuestion === null} onClick={() => void editor.nextCandidates()}>Next question page</button>
          <button type="button" disabled={locked} onClick={() => void editor.showPreview()}>Preview saved draft</button>
        </div>
        {blueprint.preview_warnings.map(warning => <p className="diagnostic-error" key={warning}>{warning}</p>)}
      </>}
      <div className="diagnostic-actions">
        <button type="button" disabled={busy || creating || !blueprint || !complete} onClick={() => valid(() => void editor.publish())}>{publishing ? "Retry publish assessment" : "Publish assessment"}</button>
        {blueprint?.latest_version && <button type="button" disabled={locked || !!blueprint.latest_version.withdrawn_at} onClick={() => void editor.withdraw()}>Withdraw version</button>}
      </div>
      {blueprint?.latest_version && <p>Latest publication: version {blueprint.latest_version.version_number} {blueprint.latest_version.withdrawn_at ? "withdrawn" : "published"}. Withdrawal blocks unfinished attempts; completed history remains.</p>}
    </form>
    {editor.preview && <section aria-label="Staff preview">
      <h2>Staff preview</h2><p>Saved revision {editor.preview.draft_revision} only. Unsaved edits are not included. This preview creates no learner evidence.</p>
      {editor.preview.preview_warnings.map(warning => <p key={warning}>{warning}</p>)}
      {editor.preview.preview.map(question => <article key={question.id}>
        <h3>Question {question.id}</h3><p>{question.question_text}</p>
        <ol>{question.options.map((option, index) => <li key={index}>{option}{index === question.correct_index ? " — reviewed answer" : ""}</li>)}</ol>
        <p>{question.explanation || "No teacher explanation provided."}</p>
      </article>)}
    </section>}
  </div>;
}
