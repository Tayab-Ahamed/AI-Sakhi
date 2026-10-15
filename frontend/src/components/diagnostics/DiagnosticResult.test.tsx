import { render, screen, within } from "@testing-library/react";
import { expect, it } from "vitest";
import type { DiagnosticResult as DiagnosticEvidenceResult } from "@/lib/diagnostics";
import { DiagnosticResult } from "./DiagnosticResult";

const skipped: DiagnosticEvidenceResult = {
  correct_count: 0, answered_count: 0, question_count: 3, skipped_count: 3,
  concept_results: [{ id: "base", label: "Foundations", correct_count: 0, answered_count: 0, question_count: 3, skipped_count: 3, state: "insufficient_evidence", review_prerequisites: [], unassessed_prerequisites: [] }],
  items: [], next_action: { kind: "collect_evidence", concept_id: "base", reason: "No questions answered for Foundations.", href: "/practice" },
  limitations: "Tentative evidence, not proof of mastery. Repeated questions are not independent evidence of improvement.",
};

it("reports skipped coverage without dividing by zero or claiming mastery", () => {
  render(<DiagnosticResult result={skipped} concepts={[]} />);
  expect(screen.getByText(/insufficient evidence/i)).toBeVisible();
  expect(screen.getByText(/3 skipped/i)).toBeVisible();
  expect(screen.getByText(/not proof of mastery/i)).toBeVisible();
  expect(screen.getByRole("heading", { name: "Diagnostic evidence" })).toHaveFocus();
  expect(screen.getByRole("link", { name: "Open school practice" })).toHaveAttribute("href", "/practice");
});

it("separates review and unassessed school-defined prerequisite reasons", () => {
  render(<DiagnosticResult result={{ ...skipped, concept_results: [{ ...skipped.concept_results[0], state: "review_suggested", review_prerequisites: [{ id: "before", label: "Earlier idea" }], unassessed_prerequisites: [{ id: "unknown", label: "Unassessed idea" }] }] }} concepts={[]} />);
  expect(screen.getByText("Review suggested")).toBeVisible();
  expect(within(screen.getByRole("group", { name: "Prerequisites suggesting review" })).getByText("Earlier idea")).toBeVisible();
  expect(within(screen.getByRole("group", { name: "Prerequisites needing more evidence" })).getByText("Unassessed idea")).toBeVisible();
});

it("shows provisional strength and server spaced-practice advice without an all-mastered label", () => {
  render(<DiagnosticResult result={{ ...skipped, correct_count: 3, answered_count: 3, skipped_count: 0,
    concept_results: [{ ...skipped.concept_results[0], correct_count: 3, answered_count: 3, skipped_count: 0, state: "provisional_strength" }],
    next_action: { kind: "spaced_practice", concept_id: null, reason: "Use spaced practice; this short result is tentative.", href: "/practice" } }} concepts={[]} />);
  expect(screen.getByText("Provisional strength")).toBeVisible();
  expect(screen.getByText("Spaced practice")).toBeVisible();
  expect(screen.queryByText(/all mastered/i)).not.toBeInTheDocument();
});

it("renders owner feedback for correct, incorrect and skipped questions", () => {
  const items = [0, 1, null].map((selected_index, i) => ({ question_id: i + 1, selected_index, correct_index: 0, is_correct: selected_index === 0, is_skipped: selected_index === null, explanation: `Teacher explanation ${i + 1}` }));
  render(<DiagnosticResult result={{ ...skipped, items }} concepts={[{ id: "base", label: "Foundations", prerequisite_ids: [], questions: items.map(item => ({ id: item.question_id, question_text: `Question text ${item.question_id}`, options: ["Yes", "No"] })) }]} />);
  expect(screen.getByText("Teacher explanation 2")).toBeVisible();
  expect(screen.getByText(/skipped — not counted incorrect/i)).toBeVisible();
  expect(screen.getByText(/your answer: no/i)).toBeVisible();
});
