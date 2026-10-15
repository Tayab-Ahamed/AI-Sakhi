import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ApiError } from "@/lib/api";
import QuizPage from "./page";
import { AccessibilityProvider } from "@/lib/accessibility-context";

const mocks = vi.hoisted(() => ({ generateQuiz: vi.fn(), evaluateQuizBatch: vi.fn(), evaluateAnswer: vi.fn(), updateProgress: vi.fn(), getRecommendedDifficulty: vi.fn(), getRagStats: vi.fn(), getOfflineCachedQuiz: vi.fn(), saveQuizToOfflineCache: vi.fn(), online: true, ready: true, user: { user_id: 1, class_: "8", language: "English", weak_subject: "Fractions" } as Record<string, unknown> | null }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(), usePathname: () => "/quiz", useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/lib/user-context", () => ({ useUser: () => ({ user: mocks.user, isReady: mocks.ready }) }));
vi.mock("@/lib/api", async (original) => ({ ...(await original<typeof import("@/lib/api")>()), api: { generateQuiz: mocks.generateQuiz, evaluateQuizBatch: mocks.evaluateQuizBatch, evaluateAnswer: mocks.evaluateAnswer, updateProgress: mocks.updateProgress, getRecommendedDifficulty: mocks.getRecommendedDifficulty, getRagStats: mocks.getRagStats } }));
vi.mock("@/lib/use-pwa", () => ({ usePwa: () => ({ isOnline: mocks.online }), getOfflineCachedQuiz: mocks.getOfflineCachedQuiz, saveQuizToOfflineCache: mocks.saveQuizToOfflineCache }));

beforeEach(() => {
  vi.resetAllMocks(); mocks.online = true; mocks.ready = true;
  mocks.user = { user_id: 1, class_: "8", language: "English", weak_subject: "Fractions" };
  mocks.getRagStats.mockResolvedValue({ ready: false, chunk_count: 0 });
  mocks.getRecommendedDifficulty.mockResolvedValue({ recommended: "medium", average_pct: null, data_points: 0 });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ json: async () => ({ notifications: [] }) }));
});
afterEach(() => vi.unstubAllGlobals());
const renderQuiz = () => render(<AccessibilityProvider><QuizPage /></AccessibilityProvider>);

describe("quiz generation errors", () => {
  it.each([401, 403])("keeps a %i denial visible without silently loading cached questions", async (status) => {
    mocks.generateQuiz.mockRejectedValue(new ApiError("Approval is required", status));
    renderQuiz();
    fireEvent.click(screen.getByRole("button", { name: "Generate 5 Questions" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/sign in|approval/i);
    expect(mocks.getOfflineCachedQuiz).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Generate 5 Questions" })).toBeEnabled();
  });
  it("shows an inline offline failure when no matching pack exists", async () => {
    mocks.online = false;
    mocks.generateQuiz.mockRejectedValue(new TypeError("fetch failed"));
    renderQuiz();
    fireEvent.click(screen.getByRole("button", { name: "Generate 5 Questions" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/offline.*no cached quiz/i);
  });
  it("does not treat a server error as permission to use an offline pack", async () => {
    mocks.generateQuiz.mockRejectedValue(new ApiError("Unavailable", 503));
    renderQuiz();
    fireEvent.click(screen.getByRole("button", { name: "Generate 5 Questions" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/could not generate/i);
    expect(mocks.getOfflineCachedQuiz).not.toHaveBeenCalled();
  });
  it("loads class subjects and topics when the session restores after a hard refresh", async () => {
    mocks.user = null; mocks.ready = false;
    const view = renderQuiz();
    mocks.user = { user_id: 1, class_: "8", language: "English", weak_subject: "Fractions" }; mocks.ready = true;
    view.rerender(<AccessibilityProvider><QuizPage /></AccessibilityProvider>);
    await waitFor(() => expect(screen.getByRole("button", { name: /mathematics/i })).toBeVisible());
    expect(screen.getByRole("button", { name: "Linear Equations" })).toBeVisible();
  });
  it("keeps answers and announces submission failure without falling back to extra writes", async () => {
    mocks.generateQuiz.mockResolvedValue({ topic: "Fractions", questions: [{ id: 1, question: "Which is a half?", options: { A: "One half", B: "One third" }, correct: "A", hint: "Equal parts", explanation: "Two equal parts" }] });
    mocks.evaluateQuizBatch.mockRejectedValue(new ApiError("Not authorized", 403));
    mocks.evaluateAnswer.mockResolvedValue({ is_correct: false, feedback: "Retry", correct_answer: "A" });
    renderQuiz();
    fireEvent.click(screen.getByRole("button", { name: "Generate 5 Questions" }));
    fireEvent.click(await screen.findByRole("button", { name: /one third/i }));
    fireEvent.click(screen.getByRole("button", { name: "Submit ✓" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/not authorized|approval/i);
    expect(screen.getByRole("button", { name: "Submit ✓" })).toBeEnabled();
    expect(mocks.evaluateAnswer).not.toHaveBeenCalled();
    expect(mocks.updateProgress).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /one third/i })).toHaveAttribute("aria-pressed", "true");
  });
});
