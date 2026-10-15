import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ApiError } from "@/lib/api";
import ReviewedPractice from "./ReviewedPractice";

const mocks = vi.hoisted(() => ({ topics: vi.fn(), start: vi.fn(), submit: vi.fn() }));
vi.mock("@/lib/api", async (original) => ({ ...(await original<typeof import("@/lib/api")>()), api: {
  getPracticeTopics: mocks.topics, startPractice: mocks.start, submitPractice: mocks.submit,
} }));
const attempt = { id: "synthetic-attempt", subject: "Math", chapter: "Fractions", status: "active", result: null,
  questions: [{ id: 12, question_text: "Which represents one half?", options: ["1/2", "1/3"] }] };
beforeEach(() => {
  vi.resetAllMocks();
  mocks.topics.mockResolvedValue({ topics: [{ subject: "Math", chapter: "Fractions", question_count: 1 }], truncated: false });
  mocks.start.mockResolvedValue(attempt);
});
const start = async () => { fireEvent.click(await screen.findByRole("button", { name: "Start practice" })); await screen.findByRole("group", { name: "Which represents one half?" }); };

describe("reviewed practice", () => {
  it("explains an empty question bank without inventing questions", async () => {
    mocks.topics.mockResolvedValue({ topics: [], truncated: false });
    render(<ReviewedPractice userId={1} />);
    expect(await screen.findByText(/ask your teacher to approve/i)).toBeVisible();
    expect(screen.queryByRole("button", { name: "Start practice" })).not.toBeInTheDocument();
  });
  it("announces loading failure and retries the topic list", async () => {
    mocks.topics.mockRejectedValueOnce(new Error("Unavailable"));
    render(<ReviewedPractice userId={1} />);
    expect(await screen.findByRole("alert")).toHaveTextContent(/could not load/i);
    fireEvent.click(screen.getByRole("button", { name: "Reload practice topics" }));
    expect(await screen.findByRole("button", { name: "Start practice" })).toBeEnabled();
  });
  it("requires all answers, submits indices only and displays server feedback", async () => {
    mocks.submit.mockResolvedValue({ ...attempt, status: "completed", result: { score: 1, total: 1,
      items: [{ question_id: 12, is_correct: true, selected_index: 0, correct_index: 0, explanation: "Two equal parts." }], next_action: "Revisit later." } });
    render(<ReviewedPractice userId={1} />); await start();
    const submit = screen.getByRole("button", { name: "Check answers" });
    expect(submit).toBeDisabled();
    expect(screen.queryByText("Two equal parts.")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "1/2" })); fireEvent.click(submit);
    expect(await screen.findByRole("heading", { name: "Practice result: 1 / 1" })).toBeVisible();
    expect(mocks.submit).toHaveBeenCalledWith("synthetic-attempt", { "12": 0 });
    expect(screen.getByText("Two equal parts.")).toBeVisible();
    expect(screen.getByRole("link", { name: "View topic mastery" })).toHaveAttribute("href", "/mastery");
  });
  it("retries creation with the same intent key after an uncertain failure", async () => {
    mocks.start.mockRejectedValueOnce(new TypeError("fetch failed"));
    render(<ReviewedPractice userId={1} />);
    fireEvent.click(await screen.findByRole("button", { name: "Start practice" }));
    await screen.findByRole("alert");
    fireEvent.click(screen.getByRole("button", { name: "Start practice" }));
    await screen.findByRole("group", { name: "Which represents one half?" });
    expect(mocks.start.mock.calls[0][0].creation_key).toEqual(mocks.start.mock.calls[1][0].creation_key);
  });
  it("preserves and locks submitted answers for an identical retry", async () => {
    mocks.submit.mockRejectedValue(new TypeError("fetch failed"));
    render(<ReviewedPractice userId={1} />); await start();
    fireEvent.click(screen.getByRole("radio", { name: "1/3" }));
    fireEvent.click(screen.getByRole("button", { name: "Check answers" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/answers.*kept/i);
    expect(screen.getByRole("radio", { name: "1/3" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "1/2" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Check answers" }));
    await waitFor(() => expect(mocks.submit).toHaveBeenCalledTimes(2));
    expect(mocks.submit.mock.calls[0]).toEqual(mocks.submit.mock.calls[1]);
  });
  it("shows recalled-question conflicts and allows a fresh attempt", async () => {
    mocks.submit.mockRejectedValue(new ApiError("A question was recalled by your school.", 409));
    render(<ReviewedPractice userId={1} />); await start();
    fireEvent.click(screen.getByRole("radio", { name: "1/2" }));
    fireEvent.click(screen.getByRole("button", { name: "Check answers" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/recalled/i);
    fireEvent.click(screen.getByRole("button", { name: "Start new practice" }));
    expect(await screen.findByRole("button", { name: "Start practice" })).toBeEnabled();
  });
  it("clears the previous learner's questions immediately when identity changes", async () => {
    const view = render(<ReviewedPractice userId={1} />); await start();
    mocks.topics.mockReturnValue(new Promise(() => {}));
    view.rerender(<ReviewedPractice userId={2} />);
    expect(screen.queryByRole("group", { name: "Which represents one half?" })).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/loading/i);
  });
});
