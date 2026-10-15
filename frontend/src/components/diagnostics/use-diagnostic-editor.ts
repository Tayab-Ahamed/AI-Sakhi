"use client";

import { useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { DiagnosticBlueprint, DiagnosticCreate, DiagnosticDefinition, DiagnosticIdentity, DiagnosticList, DiagnosticStaffQuestion } from "@/lib/diagnostics";

export function useDiagnosticEditor(identity: DiagnosticIdentity) {
  const initial = (): DiagnosticDefinition => ({ title: "", class_level: identity.class_, subject: "", concepts: [] });
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
  const alive = useRef(false), mutex = useRef(false);
  const createIntent = useRef<DiagnosticCreate | null>(null);
  const publishIntent = useRef<DiagnosticBlueprint | null>(null);
  useEffect(() => {
    alive.current = true;
    api.listDiagnosticBlueprints({ limit: 20 }).then(value => { if (alive.current) setList(value); })
      .catch(() => { if (alive.current) setError("Could not load school assessments. Reload the list to reconnect."); })
      .finally(() => { if (alive.current) setLoading(false); });
    return () => { alive.current = false; };
  }, []);
  async function run(operation: () => Promise<void>) {
    if (mutex.current) return;
    if (!navigator.onLine) { setError("Offline: reconnect before saving or publishing. No diagnostic writes are queued."); return; }
    mutex.current = true; setBusy(true); setError(""); setNotice("");
    try { await operation(); }
    catch (err) { if (alive.current) setError(err instanceof Error ? err.message : "The request failed. Reload to reconnect."); }
    finally { mutex.current = false; if (alive.current) setBusy(false); }
  }
  function accept(value: DiagnosticBlueprint) {
    if (!alive.current) return;
    setBlueprint(value); setDefinition(value.definition);
  }
  async function questionPage(saved: DiagnosticBlueprint, after_id = 0) {
    const page = await api.getDiagnosticCandidates(saved.id, { after_id, limit: 20 });
    if (!alive.current) return;
    const selected = new Set(saved.definition.concepts.flatMap(c => c.question_ids));
    setCandidates(previous => [...new Map([...previous.filter(q => selected.has(q.id)), ...saved.preview, ...page.questions].map(q => [q.id, q])).values()]);
    setNextQuestion(page.next_after_id);
  }
  const open = (id: number) => run(async () => {
    const saved = await api.getDiagnosticBlueprint(id);
    if (!alive.current) return;
    accept(saved); setCandidates([]); setPreview(null);
    createIntent.current = null; publishIntent.current = null; setCreating(false); setPublishing(false);
    await questionPage(saved);
  });
  const create = () => run(async () => {
    const intent = createIntent.current ?? { creation_key: crypto.randomUUID(), title: definition.title, class_level: definition.class_level, subject: definition.subject };
    createIntent.current = intent; setCreating(true);
    try {
      const saved = await api.createDiagnosticBlueprint(intent);
      if (!alive.current) return;
      accept(saved); createIntent.current = null; setCreating(false); setNotice("Draft created. Add concepts and reviewed questions.");
      await questionPage(saved);
    } catch (err) {
      if (err instanceof ApiError && err.status < 500) { createIntent.current = null; if (alive.current) setCreating(false); }
      throw err;
    }
  });
  async function persist() {
    if (!blueprint) throw new Error("Create a draft first.");
    const saved = await api.saveDiagnosticBlueprint(blueprint.id, { expected_revision: blueprint.draft_revision, definition });
    accept(saved); return saved;
  }
  const save = () => run(async () => { await persist(); if (alive.current) setNotice("Draft saved. Publication is a separate action."); });
  const publish = () => run(async () => {
    const saved = publishIntent.current ?? await persist();
    if (!alive.current) return;
    publishIntent.current = saved; setPublishing(true);
    try {
      const version = await api.publishDiagnosticBlueprint(saved.id, { expected_revision: saved.draft_revision });
      if (!alive.current) return;
      accept({ ...saved, latest_version: version }); publishIntent.current = null; setPublishing(false);
      setNotice(version.withdrawn_at ? `Version ${version.version_number} withdrawn; this retry did not reactivate it.` : `Version ${version.version_number} published.`);
    } catch (err) {
      if (!(err instanceof ApiError) || err.status >= 500) throw new Error("Publication delivery is uncertain. Retry publish assessment with the same saved revision, or reload its server status.");
      publishIntent.current = null; if (alive.current) setPublishing(false); throw err;
    }
  });
  const withdraw = () => run(async () => {
    if (!blueprint?.latest_version) return;
    const version = await api.withdrawDiagnosticVersion(blueprint.latest_version.id);
    if (alive.current) { accept({ ...blueprint, definition, latest_version: version }); setNotice(`Version ${version.version_number} withdrawn.`); }
  });
  const showPreview = () => run(async () => {
    if (!blueprint) return;
    const saved = await api.getDiagnosticBlueprint(blueprint.id);
    if (alive.current) setPreview(saved); // Never overwrite unsaved edits with a preview.
  });
  const loadList = (after_id = 0) => run(async () => {
    const value = await api.listDiagnosticBlueprints({ after_id, limit: 20 });
    if (alive.current) setList(previous => ({ ...value, blueprints: after_id ? [...previous.blueprints, ...value.blueprints] : value.blueprints }));
  });
  function newDraft() {
    if (mutex.current) return;
    createIntent.current = null; publishIntent.current = null;
    setCreating(false); setPublishing(false); setBlueprint(null); setDefinition(initial());
    setCandidates([]); setNextQuestion(null); setPreview(null); setError(""); setNotice("");
  }
  return { definition, setDefinition, blueprint, list, candidates, nextQuestion, preview, busy, loading, error, notice, creating, publishing,
    create, open, save, publish, withdraw, showPreview, loadList, newDraft,
    nextCandidates: () => blueprint && run(() => questionPage({ ...blueprint, definition }, nextQuestion ?? 0)),
    firstCandidates: () => blueprint && run(() => questionPage({ ...blueprint, definition })),
  };
}
