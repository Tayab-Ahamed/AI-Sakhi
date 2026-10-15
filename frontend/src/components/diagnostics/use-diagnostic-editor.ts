"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { DiagnosticBlueprint, DiagnosticCreate, DiagnosticDefinition, DiagnosticIdentity, DiagnosticList, DiagnosticStaffQuestion } from "@/lib/diagnostics";

export function useDiagnosticEditor(identity: DiagnosticIdentity) {
  const initial = useCallback((): DiagnosticDefinition => ({ title: "", class_level: identity.class_, subject: "", concepts: [] }), [identity.class_]);
  const [definition, setDefinition] = useState(initial);
  const [blueprint, setBlueprint] = useState<DiagnosticBlueprint | null>(null);
  const [list, setList] = useState<DiagnosticList>({ blueprints: [], next_after_id: null });
  const [candidates, setCandidates] = useState<DiagnosticStaffQuestion[]>([]);
  const [nextQuestion, setNextQuestion] = useState<number | null>(null);
  const [preview, setPreview] = useState<DiagnosticBlueprint | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [creating, setCreating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [unauthorized, setUnauthorized] = useState(false);
  const alive = useRef(false), mutex = useRef(false);
  const accessDenied = useRef(false);
  const createIntent = useRef<DiagnosticCreate | null>(null);
  const publishIntent = useRef<DiagnosticBlueprint | null>(null);
  const active = useCallback(() => alive.current && !accessDenied.current, []);
  const failed = useCallback((err: unknown, fallback: string, details = true) => {
    if (!active()) return;
    if (err instanceof ApiError && [401, 403].includes(err.status)) {
      // Latch denial before clearing state: no late response may restore keys or intents.
      accessDenied.current = true;
      createIntent.current = null; publishIntent.current = null;
      setUnauthorized(true); setBlueprint(null); setDefinition(initial());
      setList({ blueprints: [], next_after_id: null }); setCandidates([]); setNextQuestion(null); setPreview(null);
      setCreating(false); setPublishing(false); setBusy(false); setLoading(false); setNotice("");
      setError("School staff access is no longer available. Sign in again to continue.");
    } else setError(details && err instanceof Error ? err.message : fallback);
  }, [active, initial]);
  useEffect(() => {
    alive.current = true;
    api.listDiagnosticBlueprints({ limit: 20 }).then(value => {
      if (active()) setList(previous => ({ ...value, blueprints: [...new Map([...value.blueprints, ...previous.blueprints].map(card => [card.id, card])).values()].sort((a, b) => a.id - b.id) }));
    })
      .catch(err => failed(err, "Could not load school assessments. Reload the list to reconnect.", false))
      .finally(() => { if (active()) setLoading(false); });
    return () => { alive.current = false; };
  }, [active, failed]);
  async function run(operation: () => Promise<void>) {
    if (mutex.current || !active()) return;
    if (!navigator.onLine) { setError("Offline: reconnect before saving or publishing. No diagnostic writes are queued."); return; }
    mutex.current = true; setBusy(true); setError(""); setNotice("");
    try { await operation(); }
    catch (err) { failed(err, "The request failed. Reload to reconnect."); }
    finally { mutex.current = false; if (active()) setBusy(false); }
  }
  function accept(value: DiagnosticBlueprint) {
    if (!active()) return;
    setBlueprint(value); setDefinition(value.definition);
    const card = { id: value.id, title: value.definition.title, class_level: value.definition.class_level,
      subject: value.definition.subject, draft_revision: value.draft_revision, latest_version: value.latest_version,
      concept_count: value.definition.concepts.length, question_count: value.definition.concepts.reduce((total, concept) => total + concept.question_ids.length, 0) };
    setList(previous => ({ ...previous, blueprints: [...previous.blueprints.filter(item => item.id !== value.id), card].sort((a, b) => a.id - b.id) }));
  }
  async function questionPage(saved: DiagnosticBlueprint, after_id = 0) {
    const page = await api.getDiagnosticCandidates(saved.id, { after_id, limit: 20 });
    if (!active()) return;
    const selected = new Set(saved.definition.concepts.flatMap(c => c.question_ids));
    setCandidates(previous => [...new Map([...previous.filter(q => selected.has(q.id)), ...saved.preview, ...page.questions].map(q => [q.id, q])).values()]);
    setNextQuestion(page.next_after_id);
  }
  const open = (id: number) => run(async () => {
    const saved = await api.getDiagnosticBlueprint(id);
    if (!active()) return;
    accept(saved); setCandidates([]); setPreview(null);
    createIntent.current = null; publishIntent.current = null; setCreating(false); setPublishing(false);
    await questionPage(saved);
  });
  const create = () => run(async () => {
    const intent = createIntent.current ?? { creation_key: crypto.randomUUID(), title: definition.title, class_level: definition.class_level, subject: definition.subject };
    createIntent.current = intent; setCreating(true);
    try {
      const saved = await api.createDiagnosticBlueprint(intent);
      if (!active()) return;
      accept(saved); createIntent.current = null; setCreating(false); setNotice("Draft created. Add concepts and reviewed questions.");
      await questionPage(saved);
    } catch (err) {
      if (err instanceof ApiError && err.status < 500) { createIntent.current = null; if (active()) setCreating(false); }
      throw err;
    }
  });
  async function persist() {
    if (!blueprint) throw new Error("Create a draft first.");
    const saved = await api.saveDiagnosticBlueprint(blueprint.id, { expected_revision: blueprint.draft_revision, definition });
    accept(saved); return saved;
  }
  const save = () => run(async () => { await persist(); if (active()) setNotice("Draft saved. Publication is a separate action."); });
  const publish = () => run(async () => {
    const saved = publishIntent.current ?? await persist();
    if (!active()) return;
    publishIntent.current = saved; setPublishing(true);
    try {
      const version = await api.publishDiagnosticBlueprint(saved.id, { expected_revision: saved.draft_revision });
      if (!active()) return;
      accept({ ...saved, latest_version: version }); publishIntent.current = null; setPublishing(false);
      setNotice(version.withdrawn_at ? `Version ${version.version_number} withdrawn; this retry did not reactivate it.` : `Version ${version.version_number} published.`);
    } catch (err) {
      if (!(err instanceof ApiError) || err.status >= 500) throw new Error("Publication delivery is uncertain. Retry publish assessment with the same saved revision, or reload its server status.");
      publishIntent.current = null; if (active()) setPublishing(false); throw err;
    }
  });
  const withdraw = () => run(async () => {
    if (!blueprint?.latest_version) return;
    const version = await api.withdrawDiagnosticVersion(blueprint.latest_version.id);
    if (active()) { accept({ ...blueprint, definition, latest_version: version }); setNotice(`Version ${version.version_number} withdrawn.`); }
  });
  const showPreview = () => run(async () => {
    if (!blueprint) return;
    const saved = await api.getDiagnosticBlueprint(blueprint.id);
    if (active()) setPreview(saved); // Never overwrite unsaved edits with a preview.
  });
  const loadList = (after_id = 0) => run(async () => {
    const value = await api.listDiagnosticBlueprints({ after_id, limit: 20 });
    if (active()) setList(previous => ({ ...value, blueprints: after_id ? [...previous.blueprints, ...value.blueprints] : value.blueprints }));
  });
  function newDraft() {
    if (mutex.current || !active()) return;
    createIntent.current = null; publishIntent.current = null;
    setCreating(false); setPublishing(false); setBlueprint(null); setDefinition(initial());
    setCandidates([]); setNextQuestion(null); setPreview(null); setError(""); setNotice("");
  }
  return { definition, setDefinition, blueprint, list, candidates, nextQuestion, preview, busy, loading, error, notice, creating, publishing, unauthorized,
    create, open, save, publish, withdraw, showPreview, loadList, newDraft,
    nextCandidates: () => blueprint && run(() => questionPage({ ...blueprint, definition }, nextQuestion ?? 0)),
    firstCandidates: () => blueprint && run(() => questionPage({ ...blueprint, definition })),
  };
}
