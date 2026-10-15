import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { api, ApiError } from "@/lib/api";
import { readDiagnosticResume, saveDiagnosticResume } from "@/lib/diagnostic-resume";
import type { DiagnosticAttempt, DiagnosticVersion } from "@/lib/diagnostics";
import { DiagnosticAssessment } from "./DiagnosticAssessment";

const identity = { user_id: 1, organization_id: 1, class_: "8" };
const active: DiagnosticAttempt = { id: "00000000-0000-4000-8000-000000000001", version_id: 7, title: "School check", class_level: "8", subject: "Math", status: "active", result: null,
  concepts: [{ id: "base", label: "Foundations", prerequisite_ids: [], questions: [1, 2, 3].map(id => ({ id, question_text: `School question ${id}`, options: ["Yes", "No"] })) }] };
const version: DiagnosticVersion = { id: 7, blueprint_id: 1, version_number: 1, draft_revision: 2, class_level: "8", subject: "Math", published_at: "2026-10-15", withdrawn_at: null, concept_count: 1, question_count: 3 };
const completed: DiagnosticAttempt = { ...active, status: "completed", result: {
  correct_count: 1, answered_count: 2, question_count: 3, skipped_count: 1,
  concept_results: [{ id: "base", label: "Foundations", correct_count: 1, answered_count: 2, question_count: 3, skipped_count: 1, state: "insufficient_evidence", review_prerequisites: [], unassessed_prerequisites: [] }],
  items: [0, 1, null].map((selected_index, i) => ({ question_id: i + 1, selected_index, correct_index: 0, is_correct: selected_index === 0, is_skipped: selected_index === null, explanation: "Reviewed teacher explanation" })),
  next_action: { kind: "collect_evidence", concept_id: "base", reason: "Foundations: 2/3 answered, 1 correct. Gather more evidence.", href: "/practice" }, limitations: "Tentative evidence, not proof of mastery. Repeated questions are not independent learning gains.",
} };
beforeEach(() => {
  vi.restoreAllMocks(); localStorage.clear();
  vi.spyOn(api, "listDiagnosticBlueprints").mockResolvedValue({ blueprints: [{ id: 1, title: "School check", class_level: "8", subject: "Math", concept_count: 1, question_count: 3, latest_version: version }], next_after_id: null });
  vi.spyOn(api, "startDiagnostic").mockResolvedValue(active);
  vi.spyOn(api, "getDiagnosticAttempt").mockResolvedValue(active);
  vi.spyOn(api, "submitDiagnostic").mockResolvedValue(completed);
});
afterEach(() => { localStorage.clear(); vi.restoreAllMocks(); });
async function start() { fireEvent.click(await screen.findByRole("button", { name: "Start School check" })); await screen.findByRole("group", { name: "School question 1" }); }
function answerMixed() {
  ["Yes", "No", "I'm not sure"].forEach((choice, index) => fireEvent.click(within(screen.getByRole("group", { name: `School question ${index + 1}` })).getByRole("radio", { name: choice })));
}

it("explains an unconfigured school without inventing assessments", async () => {
  vi.mocked(api.listDiagnosticBlueprints).mockResolvedValue({ blueprints: [], next_after_id: null });
  render(<DiagnosticAssessment identity={identity} />);
  expect(await screen.findByText(/your school has not published/i)).toBeVisible();
  expect(api.startDiagnostic).not.toHaveBeenCalled();
});

it("announces list failure and permits explicit reconnect/reload", async () => {
  vi.mocked(api.listDiagnosticBlueprints).mockRejectedValueOnce(new TypeError("fetch failed"));
  render(<DiagnosticAssessment identity={identity} />);
  expect(await screen.findByRole("alert")).toHaveTextContent(/could not load/i);
  fireEvent.click(screen.getByRole("button", { name: "Reload assessments" }));
  expect(await screen.findByRole("button", { name: "Start School check" })).toBeEnabled();
});

it("requires a selection or explicit skip for every question and renders server evidence", async () => {
  render(<DiagnosticAssessment identity={identity} />); await start();
  expect(screen.getByRole("button", { name: "Submit assessment" })).toBeDisabled();
  expect(screen.queryByText(/reviewed teacher explanation/i)).not.toBeInTheDocument();
  answerMixed(); fireEvent.click(screen.getByRole("button", { name: "Submit assessment" }));
  expect(await screen.findByRole("heading", { name: "Diagnostic evidence" })).toHaveFocus();
  expect(api.submitDiagnostic).toHaveBeenCalledWith(active.id, { "1": 0, "2": 1, "3": null });
  expect(screen.getByText(/1 correct · 2 answered · 1 skipped/i)).toBeVisible();
  expect(readDiagnosticResume(identity)).toBe(active.id);
});

it("recovers uncertain start using the identical displayed-version intent", async () => {
  vi.mocked(api.startDiagnostic).mockRejectedValueOnce(new TypeError("fetch failed"));
  render(<DiagnosticAssessment identity={identity} />);
  fireEvent.click(await screen.findByRole("button", { name: "Start School check" }));
  await screen.findByRole("alert");
  fireEvent.click(screen.getByRole("button", { name: "Retry start assessment" }));
  await screen.findByRole("group", { name: "School question 1" });
  expect(vi.mocked(api.startDiagnostic).mock.calls[0]).toEqual(vi.mocked(api.startDiagnostic).mock.calls[1]);
});

it("resumes through authorized GET and honestly loses unsent choices", async () => {
  saveDiagnosticResume(identity, active.id);
  render(<DiagnosticAssessment identity={identity} />);
  expect(await screen.findByRole("group", { name: "School question 1" })).toBeVisible();
  expect(screen.getByText(/unsent choices are not restored/i)).toBeVisible();
  expect(screen.getAllByRole("radio").every(radio => !(radio as HTMLInputElement).checked)).toBe(true);
  expect(api.getDiagnosticAttempt).toHaveBeenCalledWith(active.id);
  expect(api.startDiagnostic).not.toHaveBeenCalled();
});

it("freezes the entire submission during unknown delivery and retries identically", async () => {
  vi.mocked(api.submitDiagnostic).mockRejectedValue(new TypeError("fetch failed"));
  render(<DiagnosticAssessment identity={identity} />); await start(); answerMixed();
  fireEvent.click(screen.getByRole("button", { name: "Submit assessment" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(/delivery is uncertain/i);
  screen.getAllByRole("radio").forEach(radio => expect(radio).toBeDisabled());
  fireEvent.click(screen.getByRole("button", { name: "Retry identical submission" }));
  await waitFor(() => expect(api.submitDiagnostic).toHaveBeenCalledTimes(2));
  expect(vi.mocked(api.submitDiagnostic).mock.calls[0]).toEqual(vi.mocked(api.submitDiagnostic).mock.calls[1]);
  expect(localStorage.getItem("sakhi_diagnostic_attempt:1:1:8")).toBe(active.id);
});

it("recovers a committed result after response loss and online reload without resubmission", async () => {
  vi.mocked(api.submitDiagnostic).mockRejectedValue(new TypeError("response lost"));
  const view = render(<DiagnosticAssessment identity={identity} />); await start(); answerMixed();
  fireEvent.click(screen.getByRole("button", { name: "Submit assessment" }));
  await screen.findByRole("alert"); view.unmount();
  vi.mocked(api.getDiagnosticAttempt).mockResolvedValue(completed);
  render(<DiagnosticAssessment identity={identity} />);
  expect(await screen.findByRole("heading", { name: "Diagnostic evidence" })).toHaveFocus();
  expect(api.submitDiagnostic).toHaveBeenCalledTimes(1);
});

it("explains a changed-answer conflict before displaying the authoritative stored result", async () => {
  vi.mocked(api.submitDiagnostic).mockRejectedValue(new ApiError("Already completed with different answers", 409));
  vi.mocked(api.getDiagnosticAttempt).mockResolvedValue(completed);
  render(<DiagnosticAssessment identity={identity} />); await start(); answerMixed();
  fireEvent.click(screen.getByRole("button", { name: "Submit assessment" }));
  expect(await screen.findByRole("heading", { name: "Diagnostic evidence" })).toHaveFocus();
  expect(screen.getByText(/server already stored.*your draft answers were not saved/i)).toBeVisible();
});

it.each([404, 409])("clears an unavailable resume reference (%s) and returns explicitly to the list", async status => {
  saveDiagnosticResume(identity, active.id);
  vi.mocked(api.getDiagnosticAttempt).mockRejectedValue(new ApiError("Publication recalled or unavailable", status));
  render(<DiagnosticAssessment identity={identity} />);
  expect(await screen.findByRole("alert")).toHaveTextContent(/recalled or unavailable/i);
  expect(readDiagnosticResume(identity)).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Return to assessments" }));
  expect(await screen.findByRole("button", { name: "Start School check" })).toBeVisible();
});

it("blocks recalled submission without a fallback grader or retry loop", async () => {
  vi.mocked(api.submitDiagnostic).mockRejectedValue(new ApiError("Publication withdrawn", 409));
  vi.mocked(api.getDiagnosticAttempt).mockRejectedValue(new ApiError("Publication withdrawn", 409));
  const grader = vi.spyOn(api, "evaluateQuizBatch");
  render(<DiagnosticAssessment identity={identity} />); await start(); answerMixed();
  fireEvent.click(screen.getByRole("button", { name: "Submit assessment" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(/withdrawn/i);
  expect(screen.queryByRole("group", { name: "School question 1" })).not.toBeInTheDocument();
  expect(readDiagnosticResume(identity)).toBeNull(); expect(grader).not.toHaveBeenCalled();
});

it.each([401, 403])("clears content and the resume reference after an authorization failure (%s)", async status => {
  saveDiagnosticResume(identity, active.id);
  vi.mocked(api.getDiagnosticAttempt).mockRejectedValue(new ApiError("School session no longer authorized", status));
  render(<DiagnosticAssessment identity={identity} />);
  expect(await screen.findByRole("link", { name: "Sign in again" })).toHaveAttribute("href", "/login");
  expect(readDiagnosticResume(identity)).toBeNull();
  expect(screen.queryByRole("group", { name: "School question 1" })).not.toBeInTheDocument();
});

it("unlocks selection after a definitive validation rejection", async () => {
  vi.mocked(api.submitDiagnostic).mockRejectedValue(new ApiError("Invalid answer map", 422));
  render(<DiagnosticAssessment identity={identity} />); await start(); answerMixed();
  fireEvent.click(screen.getByRole("button", { name: "Submit assessment" }));
  await screen.findByRole("alert");
  screen.getAllByRole("radio").forEach(radio => expect(radio).toBeEnabled());
});

it("immediately isolates account/class changes and erases the old reference", async () => {
  const view = render(<DiagnosticAssessment identity={identity} />); await start();
  vi.mocked(api.listDiagnosticBlueprints).mockReturnValue(new Promise(() => {}));
  view.rerender(<DiagnosticAssessment identity={{ ...identity, user_id: 2, class_: "9" }} />);
  expect(screen.queryByRole("group", { name: "School question 1" })).not.toBeInTheDocument();
  expect(readDiagnosticResume(identity)).toBeNull();
});

it("ignores a late start response after school/account change", async () => {
  let resolveOld!: (value: DiagnosticAttempt) => void;
  vi.mocked(api.startDiagnostic).mockReturnValue(new Promise(resolve => { resolveOld = resolve; }));
  const view = render(<DiagnosticAssessment identity={identity} />);
  fireEvent.click(await screen.findByRole("button", { name: "Start School check" }));
  vi.mocked(api.listDiagnosticBlueprints).mockResolvedValue({ blueprints: [], next_after_id: null });
  view.rerender(<DiagnosticAssessment identity={{ ...identity, organization_id: 2 }} />);
  await act(async () => resolveOld(active));
  expect(screen.queryByRole("group", { name: "School question 1" })).not.toBeInTheDocument();
  expect(readDiagnosticResume(identity)).toBeNull();
});

it("starts a deliberately new attempt with a new intent and clears the old reference", async () => {
  render(<DiagnosticAssessment identity={identity} />); await start();
  const key = vi.mocked(api.startDiagnostic).mock.calls[0][0].creation_key;
  fireEvent.click(screen.getByRole("button", { name: "Start a new attempt" }));
  expect(readDiagnosticResume(identity)).toBeNull(); await start();
  expect(vi.mocked(api.startDiagnostic).mock.calls[1][0].creation_key).not.toBe(key);
});

it("retains only the reference after a transient resume failure and retries GET", async () => {
  saveDiagnosticResume(identity, active.id);
  vi.mocked(api.getDiagnosticAttempt).mockRejectedValueOnce(new TypeError("fetch failed")).mockResolvedValue(active);
  render(<DiagnosticAssessment identity={identity} />);
  await screen.findByRole("alert");
  fireEvent.click(screen.getByRole("button", { name: "Retry resume" }));
  expect(await screen.findByRole("group", { name: "School question 1" })).toBeVisible();
  expect(api.startDiagnostic).not.toHaveBeenCalled();
});

it("explains offline limits and does not queue a write", async () => {
  render(<DiagnosticAssessment identity={identity} />);
  await screen.findByRole("button", { name: "Start School check" });
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
  act(() => { window.dispatchEvent(new Event("offline")); });
  expect(screen.getByText(/not cached or queued offline/i)).toBeVisible();
  expect(screen.getByRole("button", { name: "Start School check" })).toBeDisabled();
  expect(api.startDiagnostic).not.toHaveBeenCalled();
});
