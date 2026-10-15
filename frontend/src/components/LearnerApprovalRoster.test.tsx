import { beforeEach, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import LearnerApprovalRoster from "./LearnerApprovalRoster";

const mocks = vi.hoisted(() => ({ getChildren: vi.fn(), getOrganizationRoster: vi.fn(), getAiApproval: vi.fn(), decideAiApproval: vi.fn() }));
vi.mock("@/lib/api", () => ({ api: mocks }));
beforeEach(() => {
  vi.resetAllMocks();
  mocks.getAiApproval.mockResolvedValue({ approved: false, policy: { configured: false, enforced: true, sharing_notice: "Sharing notice", limitations: "Operator policy required" } });
});
it("uses only linked children and reloads approval for the selection", async () => {
  mocks.getChildren.mockResolvedValue({ children: [{ id: 4, name: "First" }, { id: 5, name: "Second" }] });
  render(<LearnerApprovalRoster actorId={3} actorRole="parent" organizationId={1} />);
  fireEvent.change(await screen.findByRole("combobox", { name: "Learner" }), { target: { value: "5" } });
  await waitFor(() => expect(mocks.getAiApproval).toHaveBeenCalledWith(5));
  expect(mocks.getChildren).toHaveBeenCalledWith(3);
  expect(mocks.getOrganizationRoster).not.toHaveBeenCalled();
});
it("loads the staff school roster", async () => {
  mocks.getOrganizationRoster.mockResolvedValue({ roster: [{ user_id: 4, name: "Learner" }] });
  render(<LearnerApprovalRoster actorId={3} actorRole="teacher" organizationId={2} />);
  await screen.findByRole("combobox");
  expect(mocks.getOrganizationRoster).toHaveBeenCalledWith(2);
});
it("shows a meaningful empty roster", async () => {
  mocks.getChildren.mockResolvedValue({ children: [] });
  render(<LearnerApprovalRoster actorId={3} actorRole="parent" />);
  expect(await screen.findByText(/no authorized learners/i)).toBeInTheDocument();
});
it("recovers from a roster service failure", async () => {
  mocks.getChildren.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({ children: [] });
  render(<LearnerApprovalRoster actorId={3} actorRole="parent" />);
  expect(await screen.findByRole("alert")).toHaveTextContent(/could not load/i);
  fireEvent.click(screen.getByRole("button", { name: /reload learners/i }));
  expect(await screen.findByText(/no authorized learners/i)).toBeInTheDocument();
});
