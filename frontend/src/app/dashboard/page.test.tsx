import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import DashboardPage from "./page";

const mocks = vi.hoisted(() => ({ push: vi.fn(), getDashboard: vi.fn(), getProgress: vi.fn(), getUserReport: vi.fn(), listArtifacts: vi.fn(), getRecommendations: vi.fn(), getDueFlashcards: vi.fn(), getSmartSprint: vi.fn(), getStudentAssignments: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: mocks.push }) }));
vi.mock("@/components/Sidebar", () => ({ default: () => null }));
vi.mock("@/lib/user-context", () => ({ useUser: () => ({ user: { user_id: 1, role: "student", name: "Test learner", organization_id: 1, class_: "8" }, isReady: true, sessionId: "test-session" }) }));
vi.mock("@/lib/api", () => ({ api: mocks }));

beforeEach(() => {
  vi.resetAllMocks(); localStorage.clear();
  mocks.getProgress.mockResolvedValue({ history: [], streak: 0 });
  mocks.getUserReport.mockResolvedValue({ weak_topics: [], recent_history: [] });
  mocks.listArtifacts.mockResolvedValue({ artifacts: [] });
  mocks.getRecommendations.mockResolvedValue({ next_topics: [] });
  mocks.getDueFlashcards.mockResolvedValue({ stats: { due_now: 0 } });
  mocks.getSmartSprint.mockResolvedValue({ blocks: [] });
  mocks.getStudentAssignments.mockResolvedValue([]);
});

describe("learner dashboard boundaries", () => {
  it("loads learner progress without requesting staff-only school analytics", async () => {
    render(<DashboardPage />);
    await waitFor(() => expect(mocks.getProgress).toHaveBeenCalledWith(1));
    expect(mocks.getDashboard).not.toHaveBeenCalled();
    expect(await screen.findByText("Study Library")).toBeInTheDocument();
    expect(mocks.listArtifacts).toHaveBeenCalledWith(1);
  });
  it("shows a persistent recoverable error when core progress cannot load", async () => {
    mocks.getProgress.mockRejectedValue(new Error("offline"));
    render(<DashboardPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent(/could not load/i);
    expect(screen.getByRole("button", { name: /retry/i })).toBeEnabled();
  });
});
