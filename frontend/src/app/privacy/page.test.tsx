import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import PrivacyPage from "./page";

const mocks = vi.hoisted(() => ({
  push: vi.fn(), clearUser: vi.fn().mockResolvedValue(undefined),
  getSessions: vi.fn(), getPrivacyRequests: vi.fn(), requestPrivacyAction: vi.fn(), revokeSession: vi.fn(),
  getAiApproval: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push, replace: vi.fn() }) }));
vi.mock("@/lib/user-context", () => ({ useUser: () => ({
  user: { user_id: 1, role: "student" }, auth: { expires_at: "2030-01-01" }, isReady: true, clearUser: mocks.clearUser,
}) }));
vi.mock("@/lib/api", () => ({ api: {
  getSessions: mocks.getSessions, getPrivacyRequests: mocks.getPrivacyRequests,
  requestPrivacyAction: mocks.requestPrivacyAction, revokeSession: mocks.revokeSession,
  getAiApproval: mocks.getAiApproval,
} }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSessions.mockResolvedValue({ sessions: [{ id: "current", is_current: true, expires_at: "2030-01-01" }] });
  mocks.getPrivacyRequests.mockResolvedValue({ requests: [] });
  mocks.requestPrivacyAction.mockResolvedValue({});
  mocks.getAiApproval.mockResolvedValue({ approved: false, processing_restricted: false, ai_allowed: true, policy: { configured: false, enforced: false, chat_retention_days: null, sharing_notice: "AI sharing notice", limitations: "Operator policy is required." } });
});

describe("account privacy controls", () => {
  it("renders account sessions and meaningful empty requests", async () => {
    render(<PrivacyPage />);
    expect(await screen.findByText(/no requests submitted/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign out here/i })).toBeEnabled();
  });
  it("shows a recoverable error when the service is unavailable", async () => {
    mocks.getSessions.mockRejectedValueOnce(new Error("offline"));
    render(<PrivacyPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent(/could not load/i);
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    await screen.findByText(/no requests submitted/i);
  });
  it("submits processing restriction for the authenticated learner", async () => {
    render(<PrivacyPage />);
    await screen.findByText(/no requests submitted/i);
    fireEvent.click(screen.getByRole("button", { name: /restrict ai processing/i }));
    await waitFor(() => expect(mocks.requestPrivacyAction).toHaveBeenCalledWith(1, "restrict_processing"));
    expect(await screen.findByText(/not a claim that erasure is already complete/i)).toBeInTheDocument();
  });
  it("does not submit destructive requests when confirmation is declined", async () => {
    vi.spyOn(window, "confirm").mockReturnValueOnce(false);
    render(<PrivacyPage />);
    await screen.findByText(/no requests submitted/i);
    fireEvent.click(screen.getByRole("button", { name: /request account removal/i }));
    expect(mocks.requestPrivacyAction).not.toHaveBeenCalled();
  });
  it("clears the device session before navigating after logout", async () => {
    render(<PrivacyPage />);
    fireEvent.click(await screen.findByRole("button", { name: /sign out here/i }));
    await waitFor(() => expect(mocks.clearUser).toHaveBeenCalledOnce());
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/"));
  });
});
