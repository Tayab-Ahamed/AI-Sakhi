/** Diagnostic evidence is separate from legacy mastery. Pending questions have no key. */
export type DiagnosticIdentity = { user_id: number; organization_id: number; class_: string };
export type DiagnosticConcept = { id: string; label: string; prerequisite_ids: string[]; question_ids: number[] };
export type DiagnosticDefinition = { title: string; class_level: string; subject: string; concepts: DiagnosticConcept[] };
export type DiagnosticQuestion = { id: number; question_text: string; options: string[] };
export type DiagnosticStaffQuestion = DiagnosticQuestion & { correct_index: number; explanation: string };
export type DiagnosticVersion = {
  id: number; blueprint_id: number; version_number: number; draft_revision: number;
  class_level: string; subject: string; published_at: string; withdrawn_at: string | null;
  concept_count: number; question_count: number;
};
export type DiagnosticBlueprint = {
  id: number; definition: DiagnosticDefinition; draft_revision: number; latest_version: DiagnosticVersion | null;
  preview: DiagnosticStaffQuestion[]; preview_warnings: string[];
};
export type DiagnosticCard = {
  id: number; title: string; class_level: string; subject: string; concept_count: number; question_count: number;
  latest_version: DiagnosticVersion | null; draft_revision?: number;
};
export type DiagnosticList = { blueprints: DiagnosticCard[]; next_after_id: number | null };
export type DiagnosticCandidates = { questions: DiagnosticStaffQuestion[]; next_after_id: number | null };
export type DiagnosticAnswers = Record<string, number | null>;
export type DiagnosticCounts = { correct_count: number; answered_count: number; question_count: number; skipped_count: number };
export type DiagnosticEvidenceState = "insufficient_evidence" | "review_suggested" | "provisional_strength";
export type DiagnosticConceptResult = DiagnosticCounts & {
  id: string; label: string; state: DiagnosticEvidenceState;
  review_prerequisites: { id: string; label: string }[];
  unassessed_prerequisites: { id: string; label: string }[];
};
export type DiagnosticResult = DiagnosticCounts & {
  concept_results: DiagnosticConceptResult[];
  items: { question_id: number; selected_index: number | null; correct_index: number; is_correct: boolean; is_skipped: boolean; explanation: string }[];
  next_action: { kind: "collect_evidence" | "review" | "spaced_practice"; concept_id: string | null; reason: string; href: "/practice" };
  limitations: string;
};
export type DiagnosticAttempt = {
  id: string; version_id: number; title: string; class_level: string; subject: string; status: "active" | "completed";
  concepts: { id: string; label: string; prerequisite_ids: string[]; questions: DiagnosticQuestion[] }[];
  result: DiagnosticResult | null;
};
export type DiagnosticPage = { after_id?: number; limit?: number };
export type DiagnosticCreate = { creation_key: string; title: string; class_level: string; subject: string };
export type DiagnosticSave = { expected_revision: number; definition: DiagnosticDefinition };
export type DiagnosticPublish = { expected_revision: number };
export type DiagnosticStart = { creation_key: string; version_id: number };
