import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { api, ApiError } from "@/lib/api";
import type { DiagnosticBlueprint, DiagnosticStaffQuestion, DiagnosticVersion } from "@/lib/diagnostics";
import { DiagnosticEditor } from "./DiagnosticEditor";

const identity = { user_id: 3, organization_id: 1, class_: "8" };
const questions: DiagnosticStaffQuestion[] = [1, 2, 3].map(id => ({ id, question_text: `School question ${id}`, options: ["Yes", "No"], correct_index: 0, explanation: "School explanation" }));
const version: DiagnosticVersion = { id: 7, blueprint_id: 1, version_number: 1, draft_revision: 3, class_level: "8", subject: "Math", published_at: "2026-10-15", withdrawn_at: null, concept_count: 1, question_count: 3 };
const blueprint: DiagnosticBlueprint = { id: 1, draft_revision: 2, latest_version: null, preview: questions, preview_warnings: [],
  definition: { title: "School check", class_level: "8", subject: "Math", concepts: [{ id: "base", label: "Foundations", prerequisite_ids: [], question_ids: [1, 2, 3] }] } };

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(api, "listDiagnosticBlueprints").mockResolvedValue({ blueprints: [{ id: 1, title: "School check", class_level: "8", subject: "Math", concept_count: 1, question_count: 3, latest_version: null, draft_revision: 2 }], next_after_id: null });
  vi.spyOn(api, "getDiagnosticBlueprint").mockResolvedValue(blueprint);
  vi.spyOn(api, "getDiagnosticCandidates").mockResolvedValue({ questions, next_after_id: null });
  vi.spyOn(api, "saveDiagnosticBlueprint").mockImplementation(async (id, input) => ({ ...blueprint, id, definition: input.definition, draft_revision: input.expected_revision + 1 }));
  vi.spyOn(api, "publishDiagnosticBlueprint").mockResolvedValue(version);
  vi.spyOn(api, "withdrawDiagnosticVersion").mockResolvedValue({ ...version, withdrawn_at: "2026-10-15" });
});
async function open() {
  fireEvent.click(await screen.findByRole("button", { name: "Edit School check" }));
  await waitFor(() => expect(screen.getByRole("textbox", { name: "Assessment title" })).toHaveValue("School check"));
}

it("shows labelled metadata and disables publication for an empty graph", async () => {
  vi.mocked(api.listDiagnosticBlueprints).mockResolvedValue({ blueprints: [], next_after_id: null });
  render(<DiagnosticEditor identity={identity} />);
  expect(await screen.findByRole("heading", { name: /assessment setup/i })).toBeVisible();
  expect(screen.getByRole("button", { name: /publish assessment/i })).toBeDisabled();
  expect(screen.getByRole("textbox", { name: "Class" })).toHaveValue("8");
  expect(screen.getByRole("textbox", { name: "Subject" })).toBeVisible();
});

it("recovers uncertain creation with the same frozen intent", async () => {
  const create = vi.spyOn(api, "createDiagnosticBlueprint").mockRejectedValueOnce(new TypeError("fetch failed")).mockResolvedValue({ ...blueprint, draft_revision: 1, definition: { ...blueprint.definition, title: "New check", concepts: [] } });
  render(<DiagnosticEditor identity={identity} />);
  fireEvent.change(screen.getByRole("textbox", { name: "Assessment title" }), { target: { value: "New check" } });
  fireEvent.change(screen.getByRole("textbox", { name: "Subject" }), { target: { value: "Math" } });
  fireEvent.click(screen.getByRole("button", { name: "Create draft" }));
  await screen.findByRole("alert");
  expect(screen.getByRole("textbox", { name: "Assessment title" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: /retry create draft/i }));
  await waitFor(() => expect(create).toHaveBeenCalledTimes(2));
  expect(create.mock.calls[0]).toEqual(create.mock.calls[1]);
});

it("preserves local edits on stale save and reloads only on request", async () => {
  vi.mocked(api.saveDiagnosticBlueprint).mockRejectedValue(new ApiError("Draft changed. Reload before saving.", 409));
  render(<DiagnosticEditor identity={identity} />); await open();
  fireEvent.change(screen.getByRole("textbox", { name: "Assessment title" }), { target: { value: "My unsaved edit" } });
  fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(/draft changed/i);
  expect(screen.getByRole("textbox", { name: "Assessment title" })).toHaveValue("My unsaved edit");
  fireEvent.click(screen.getByRole("button", { name: "Reload saved draft" }));
  await waitFor(() => expect(screen.getByRole("textbox", { name: "Assessment title" })).toHaveValue("School check"));
});

it("retries publication at the saved revision without another save", async () => {
  vi.mocked(api.publishDiagnosticBlueprint).mockRejectedValueOnce(new TypeError("fetch failed")).mockResolvedValue(version);
  render(<DiagnosticEditor identity={identity} />); await open();
  fireEvent.click(screen.getByRole("button", { name: "Publish assessment" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(/publication.*uncertain/i);
  expect(screen.getByRole("textbox", { name: "Assessment title" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: /retry publish assessment/i }));
  expect(await screen.findByText(/^version 1 published\./i)).toBeVisible();
  expect(api.saveDiagnosticBlueprint).toHaveBeenCalledTimes(1);
  expect(vi.mocked(api.publishDiagnosticBlueprint).mock.calls).toEqual([[1, { expected_revision: 3 }], [1, { expected_revision: 3 }]]);
});

it("shows saved staff-only preview without starting a learner attempt", async () => {
  const start = vi.spyOn(api, "startDiagnostic");
  const submit = vi.spyOn(api, "submitDiagnostic");
  render(<DiagnosticEditor identity={identity} />); await open();
  fireEvent.click(screen.getByRole("button", { name: "Preview saved draft" }));
  const preview = await screen.findByRole("region", { name: "Staff preview" });
  expect(within(preview).getAllByText(/school explanation/i)).toHaveLength(3);
  expect(start).not.toHaveBeenCalled(); expect(submit).not.toHaveBeenCalled();
});

it("withdraws the latest version and shows its terminal status", async () => {
  vi.mocked(api.getDiagnosticBlueprint).mockResolvedValue({ ...blueprint, latest_version: version });
  render(<DiagnosticEditor identity={identity} />); await open();
  fireEvent.click(screen.getByRole("button", { name: "Withdraw version" }));
  expect(await screen.findByText(/^version 1 withdrawn\./i)).toBeVisible();
  expect(screen.getByRole("button", { name: "Withdraw version" })).toBeDisabled();
});

it("advances an empty candidate page and keeps unavailable preview warnings visible", async () => {
  vi.mocked(api.getDiagnosticBlueprint).mockResolvedValue({ ...blueprint, preview: [], preview_warnings: ["Question 1 is unavailable for this draft."] });
  vi.mocked(api.getDiagnosticCandidates).mockResolvedValueOnce({ questions: [], next_after_id: 100 }).mockResolvedValue({ questions, next_after_id: null });
  render(<DiagnosticEditor identity={identity} />); await open();
  expect(await screen.findByText(/question 1 is unavailable/i)).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Next question page" }));
  expect(await screen.findByRole("checkbox", { name: /question 1: school question/i })).toBeVisible();
  expect(api.getDiagnosticCandidates).toHaveBeenLastCalledWith(1, { after_id: 100, limit: 20 });
});

it("blocks removal and renaming of a referenced concept until its edge is removed", async () => {
  vi.mocked(api.getDiagnosticBlueprint).mockResolvedValue({ ...blueprint, definition: { ...blueprint.definition, concepts: [...blueprint.definition.concepts, { id: "next", label: "Next idea", prerequisite_ids: ["base"], question_ids: [] }] } });
  render(<DiagnosticEditor identity={identity} />); await open();
  expect(screen.getByRole("button", { name: "Remove Foundations" })).toBeDisabled();
  fireEvent.click(screen.getByRole("checkbox", { name: /review foundations first/i }));
  fireEvent.click(screen.getByRole("button", { name: "Remove Foundations" }));
  expect(screen.queryByRole("group", { name: "Concept: Foundations" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Add concept" }));
  expect(screen.getByRole("group", { name: /concept: new concept/i })).toBeVisible();
});

it("discards old-school state and ignores late responses after an identity change", async () => {
  let resolveOld!: (value: Awaited<ReturnType<typeof api.getDiagnosticBlueprint>>) => void;
  vi.mocked(api.getDiagnosticBlueprint).mockReturnValueOnce(new Promise(resolve => { resolveOld = resolve; }));
  const view = render(<DiagnosticEditor identity={identity} />);
  fireEvent.click(await screen.findByRole("button", { name: "Edit School check" }));
  vi.mocked(api.listDiagnosticBlueprints).mockResolvedValue({ blueprints: [], next_after_id: null });
  view.rerender(<DiagnosticEditor identity={{ ...identity, organization_id: 2 }} />);
  await act(async () => resolveOld(blueprint));
  expect(screen.getByRole("textbox", { name: "Assessment title" })).toHaveValue("");
  expect(screen.queryByRole("group", { name: "Concept: Foundations" })).not.toBeInTheDocument();
});

it("announces list failure and reconnects through explicit reload", async () => {
  vi.mocked(api.listDiagnosticBlueprints).mockRejectedValueOnce(new TypeError("fetch failed")).mockResolvedValue({ blueprints: [], next_after_id: null });
  render(<DiagnosticEditor identity={identity} />);
  expect(await screen.findByRole("alert")).toHaveTextContent(/could not load/i);
  fireEvent.click(screen.getByRole("button", { name: "Reload assessment list" }));
  expect(await screen.findByText(/no assessments yet/i)).toBeVisible();
});

it("shows definitive publication rejection and unlocks the draft for correction", async () => {
  vi.mocked(api.publishDiagnosticBlueprint).mockRejectedValue(new ApiError("Selected questions are unavailable.", 422));
  render(<DiagnosticEditor identity={identity} />); await open();
  fireEvent.click(screen.getByRole("button", { name: "Publish assessment" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(/questions are unavailable/i);
  expect(screen.getByRole("textbox", { name: "Assessment title" })).toBeEnabled();
});
