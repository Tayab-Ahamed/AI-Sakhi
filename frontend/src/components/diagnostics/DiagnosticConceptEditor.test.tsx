import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import type { DiagnosticConcept, DiagnosticStaffQuestion } from "@/lib/diagnostics";
import { DiagnosticConceptEditor } from "./DiagnosticConceptEditor";

const concept: DiagnosticConcept = { id: "base", label: "Foundations", prerequisite_ids: [], question_ids: [] };
const peer: DiagnosticConcept = { id: "next", label: "Next idea", prerequisite_ids: [], question_ids: [4] };
const candidates: DiagnosticStaffQuestion[] = [1, 2, 3, 4].map(id => ({ id, question_text: `School question ${id}`, options: ["Yes", "No"], correct_index: 0, explanation: "School explanation" }));
function Harness() {
  const [value, change] = useState(concept);
  return <DiagnosticConceptEditor concept={value} peers={[value, peer]} candidates={candidates} disabled={false} onChange={change} />;
}

it("uses labelled metadata and exactly three distinct available selections", () => {
  render(<Harness />);
  expect(screen.getByRole("textbox", { name: "Concept ID" })).toHaveAttribute("maxLength", "40");
  expect(screen.getByRole("textbox", { name: "Concept label" })).toHaveAttribute("maxLength", "80");
  expect(screen.getByRole("checkbox", { name: /question 4/i })).toBeDisabled();
  [1, 2, 3].forEach(id => fireEvent.click(screen.getByRole("checkbox", { name: new RegExp(`question ${id}:`, "i") })));
  expect(screen.getByText(/3 of 3 selected/i)).toBeVisible();
  fireEvent.click(screen.getByRole("checkbox", { name: /question 2:/i }));
  expect(screen.getByText(/2 of 3 selected/i)).toBeVisible();
});

it("edits Unicode labels and native prerequisite checkboxes", () => {
  render(<Harness />);
  fireEvent.change(screen.getByRole("textbox", { name: "Concept label" }), { target: { value: "आधार" } });
  expect(screen.getByRole("textbox", { name: "Concept label" })).toHaveValue("आधार");
  fireEvent.click(screen.getByRole("checkbox", { name: /review next idea first/i }));
  expect(screen.getByRole("checkbox", { name: /review next idea first/i })).toBeChecked();
});

it("blocks renaming a referenced concept instead of leaving a dangling edge", () => {
  render(<DiagnosticConceptEditor concept={concept} peers={[concept, { ...peer, prerequisite_ids: ["base"] }]} candidates={[]} disabled={false} onChange={vi.fn()} />);
  expect(screen.getByRole("textbox", { name: "Concept ID" })).toBeDisabled();
  expect(screen.getByText(/remove its prerequisite references before renaming/i)).toBeVisible();
  expect(screen.getByText(/no eligible questions on this page/i)).toBeVisible();
});

it("disables all editing while a mutation is unresolved", () => {
  render(<DiagnosticConceptEditor concept={concept} peers={[concept, peer]} candidates={candidates} disabled onChange={vi.fn()} />);
  expect(screen.getByRole("textbox", { name: "Concept label" })).toBeDisabled();
  expect(screen.getByRole("checkbox", { name: /question 1:/i })).toBeDisabled();
});
