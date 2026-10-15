import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import AiApprovalPanel, { type ApprovalState } from "./AiApprovalPanel";

const mocks = vi.hoisted(() => ({ getAiApproval: vi.fn(), decideAiApproval: vi.fn() }));
vi.mock("@/lib/api", () => ({ api: mocks }));
const state: ApprovalState = {
  approved: false, processing_restricted: false, ai_allowed: false,
  policy: { configured: true, enforced: true, approval_mode: "guardian", policy_version: "v1", chat_retention_days: null, sharing_notice: "AI content is shared with the model provider.", limitations: "Backups and provider retention are separate." },
};
beforeEach(() => { vi.resetAllMocks(); mocks.getAiApproval.mockResolvedValue(state); });

describe("AI approval controls", () => {
  it("should clear the previous learner state immediately when the subject changes", async () => {
    const view = render(<AiApprovalPanel userId={9} role="student" actorRole="parent" />);
    fireEvent.click(await screen.findByRole("checkbox"));
    mocks.getAiApproval.mockReturnValueOnce(new Promise(() => {}));
    view.rerender(<AiApprovalPanel userId={10} role="student" actorRole="parent" />);
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /approve learner/i })).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/loading/i);
  });
  it("should allow linked-parent acknowledgement for a learner", async () => {
    mocks.decideAiApproval.mockResolvedValue({ ...state, approved: true });
    render(<AiApprovalPanel userId={9} role="student" actorRole="parent" subjectName="Test learner" />);
    fireEvent.click(await screen.findByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: /approve learner/i }));
    await waitFor(() => expect(mocks.decideAiApproval).toHaveBeenCalledWith(9, true, "v1"));
  });
  it("should keep school staff read-only under guardian policy", async () => {
    render(<AiApprovalPanel userId={9} role="student" actorRole="teacher" />);
    expect(await screen.findByText(/selected policy does not authorize/i)).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });
  it("should allow school staff under school approval policy", async () => {
    mocks.getAiApproval.mockResolvedValue({ ...state, policy: { ...state.policy, approval_mode: "school" } });
    render(<AiApprovalPanel userId={9} role="student" actorRole="teacher" />);
    expect(await screen.findByRole("checkbox")).toBeInTheDocument();
  });
  it("should disclose sharing and guardian authority without student self-approval", async () => {
    render(<AiApprovalPanel userId={7} role="student" />);
    expect(await screen.findByText(/your linked parent/i)).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(mocks.getAiApproval).toHaveBeenCalledWith(7);
  });
  it("should require acknowledgement before adult self-approval", async () => {
    mocks.decideAiApproval.mockResolvedValue({ ...state, approved: true, ai_allowed: true });
    render(<AiApprovalPanel userId={7} role="teacher" />);
    const button = await screen.findByRole("button", { name: /approve my/i });
    expect(button).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox")); fireEvent.click(button);
    await waitFor(() => expect(mocks.decideAiApproval).toHaveBeenCalledWith(7, true, "v1"));
    expect(await screen.findByText(/current policy approved/i)).toBeInTheDocument();
  });
  it("should withdraw existing student approval", async () => {
    mocks.getAiApproval.mockResolvedValue({ ...state, approved: true });
    mocks.decideAiApproval.mockResolvedValue(state);
    render(<AiApprovalPanel userId={7} role="student" />);
    fireEvent.click(await screen.findByRole("button", { name: /withdraw/i }));
    await waitFor(() => expect(mocks.decideAiApproval).toHaveBeenCalledWith(7, false, "v1"));
    expect(await screen.findByText(/current approval is required/i)).toBeInTheDocument();
  });
  it("should disclose unconfigured development policy without approval controls", async () => {
    mocks.getAiApproval.mockResolvedValue({ ...state, policy: { ...state.policy, configured: false, enforced: false } });
    render(<AiApprovalPanel userId={7} role="teacher" />);
    expect(await screen.findByText(/development mode/i)).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });
  it("should recover from a loading error", async () => {
    mocks.getAiApproval.mockRejectedValueOnce(new Error("offline"));
    render(<AiApprovalPanel userId={7} role="student" />);
    expect(await screen.findByRole("alert")).toHaveTextContent(/could not load/i);
    fireEvent.click(screen.getByRole("button", { name: /reload/i }));
    expect(await screen.findByText(/your linked parent/i)).toBeInTheDocument();
  });
  it("should not report success when saving fails", async () => {
    mocks.getAiApproval.mockResolvedValue({ ...state, approved: true });
    mocks.decideAiApproval.mockRejectedValueOnce(new Error("policy changed"));
    render(<AiApprovalPanel userId={7} role="student" />);
    fireEvent.click(await screen.findByRole("button", { name: /withdraw/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/could not be saved/i);
  });
  it("should keep independent processing restrictions visible", async () => {
    mocks.getAiApproval.mockResolvedValue({ ...state, processing_restricted: true });
    render(<AiApprovalPanel userId={7} role="teacher" />);
    fireEvent.click(await screen.findByRole("checkbox"));
    expect(screen.getByRole("button", { name: /approve my/i })).toBeDisabled();
    expect(screen.getByText(/restricted for this account/i)).toBeInTheDocument();
  });
});
