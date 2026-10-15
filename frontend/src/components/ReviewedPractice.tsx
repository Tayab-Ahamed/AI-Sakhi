"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import type { PracticeAttempt, PracticeIntent, PracticeTopic } from "@/lib/practice";

export default function ReviewedPractice({ userId }: { userId: number }) {
  return <PracticeSession key={userId} />;
}

function PracticeSession() {
  const id = useId();
  const [topics, setTopics] = useState<PracticeTopic[]>([]);
  const [selected, setSelected] = useState("0");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [listError, setListError] = useState(false);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [truncated, setTruncated] = useState(false);
  const [attempt, setAttempt] = useState<PracticeAttempt | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitted, setSubmitted] = useState<Record<string, number> | null>(null);
  const intent = useRef<PracticeIntent | null>(null);
  const pending = useRef(false);
  const alive = useRef(true);
  const resultHeading = useRef<HTMLHeadingElement>(null);
  const chosen = topics[Number(selected)];

  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => {
    let ignore = false;
    api.getPracticeTopics().then((data) => {
      if (!ignore) { setTopics(data.topics); setTruncated(data.truncated); setListError(false); }
    }).catch(() => {
      if (!ignore) { setError("Could not load school practice topics. Please reload."); setListError(true); }
    }).finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, [reload]);
  useEffect(() => { if (attempt?.status === "completed") resultHeading.current?.focus(); }, [attempt?.status]);

  const reloadTopics = () => { setLoading(true); setError(""); setReload((r) => r + 1); };
  const reset = () => {
    setAttempt(null); setAnswers({}); setSubmitted(null); intent.current = null;
    setSelected("0"); reloadTopics();
  };
  const start = async () => {
    if (!chosen || pending.current) return;
    pending.current = true; setBusy(true); setError("");
    intent.current ||= { creation_key: crypto.randomUUID(), subject: chosen.subject, chapter: chosen.chapter, count: 5 };
    try {
      const next = await api.startPractice(intent.current);
      if (alive.current) { setAttempt(next); setAnswers({}); setSubmitted(null); }
    } catch (cause) {
      if (alive.current) setError(cause instanceof ApiError ? cause.message : "Could not start practice. Retry to recover the same attempt.");
    } finally { pending.current = false; if (alive.current) setBusy(false); }
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!attempt || pending.current || attempt.questions.some((q) => answers[q.id] === undefined)) return;
    pending.current = true; setBusy(true); setError("");
    const frozen = submitted || { ...answers };
    setSubmitted(frozen);
    try {
      const next = await api.submitPractice(attempt.id, frozen);
      if (alive.current) setAttempt(next);
    } catch (cause) {
      if (alive.current) {
        setError(`${cause instanceof ApiError ? cause.message : "Could not confirm the result."} Your answers are kept for an identical retry.`);
        if (cause instanceof ApiError && cause.status === 422) setSubmitted(null);
      }
    } finally { pending.current = false; if (alive.current) setBusy(false); }
  };

  return (
    <section className="card reviewed-practice" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`}>Teacher-reviewed practice</h2>
      <p className="practice-description">Use your school&apos;s approved questions. No AI provider is called; questions remain in the language your teacher wrote them.</p>
      {error && <p role="alert" className="practice-error">{error}</p>}
      {loading && <p role="status">Loading school practice topics…</p>}
      {!attempt && !loading && (listError ? (
        <button className="btn btn-secondary" onClick={reloadTopics}>Reload practice topics</button>
      ) : topics.length === 0 ? (
        <p>No reviewed questions for your class yet. Ask your teacher to approve multiple-choice questions in the school bank.</p>
      ) : (
        <div className="practice-setup">
          <label htmlFor={`${id}-topic`}>Practice topic</label>
          <select id={`${id}-topic`} className="input" value={selected} disabled={busy} onChange={(e) => {
            setSelected(e.target.value); intent.current = null; setError("");
          }}>
            {topics.map((topic, index) => <option key={`${topic.subject}:${topic.chapter}`} value={index}>
              {topic.subject} · {topic.chapter || "General"} ({topic.question_count} reviewed)
            </option>)}
          </select>
          {truncated && <p>Showing topics from the first 1,000 reviewed questions for your class.</p>}
          <button className="btn btn-primary" disabled={busy || !chosen} onClick={start}>{busy ? "Starting…" : "Start practice"}</button>
        </div>
      ))}
      {attempt?.status === "active" && (
        <form onSubmit={submit} className="practice-questions">
          <h3>{attempt.chapter || attempt.subject} practice</h3>
          <p>Answer every question. Submitted answers lock so a network retry cannot change your result.</p>
          {attempt.questions.map((question) => <fieldset key={question.id} disabled={busy || submitted !== null}>
            <legend>{question.question_text}</legend>
            {question.options.map((option, index) => <label key={index} className="practice-option">
              <input type="radio" name={`${id}-${question.id}`} checked={answers[question.id] === index}
                onChange={() => setAnswers((current) => ({ ...current, [question.id]: index }))} />
              <span>{option}</span>
            </label>)}
          </fieldset>)}
          <button type="submit" className="btn btn-primary" disabled={busy || attempt.questions.some((q) => answers[q.id] === undefined)}>{busy ? "Checking…" : "Check answers"}</button>
          {error && <button type="button" className="btn btn-secondary" disabled={busy} onClick={reset}>Start new practice</button>}
        </form>
      )}
      {attempt?.status === "completed" && attempt.result && <div className="practice-result">
        <h3 tabIndex={-1} ref={resultHeading}>Practice result: {attempt.result.score} / {attempt.result.total}</h3>
        <p role="status">Saved to your learning progress.</p>
        {attempt.questions.map((question) => {
          const item = attempt.result!.items.find((r) => r.question_id === question.id);
          return item && <div className="practice-feedback" key={question.id}>
            <p><strong>{question.question_text}</strong></p>
            <p>{item.is_correct ? "Correct" : "Not yet correct"} · Correct answer: {question.options[item.correct_index]}</p>
            <p>{item.explanation || "Ask your teacher to explain the reasoning for this question."}</p>
          </div>;
        })}
        <p>{attempt.result.next_action}</p>
        <div className="practice-actions">
          <Link className="btn btn-secondary" href="/mastery">View topic mastery</Link>
          <button className="btn btn-primary" onClick={reset}>Practise again</button>
        </div>
      </div>}
    </section>
  );
}
