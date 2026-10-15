import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import { AccessibilityProvider } from "@/lib/accessibility-context";
import * as userContext from "@/lib/user-context";
import { readDiagnosticResume, saveDiagnosticResume } from "@/lib/diagnostic-resume";
import DiagnosticsPage from "./page";
import DiagnosticEditorPage from "../teacher/diagnostics/page";

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router, usePathname: () => "/diagnostics" }));
const readyStudentContext: ReturnType<typeof userContext.useUser> = {
  user: { user_id: 1, name: "Synthetic learner", class_: "8", language: "English", weak_subject: "Math", role: "student", organization_id: 1 },
  auth: { user_id: 1, expires_at: "2030-01-01", token_type: "Cookie" }, sessionId: "diagnostic-test", isReady: true,
  setUser: vi.fn(), refreshUser: vi.fn().mockResolvedValue(undefined), updateProfile: vi.fn().mockResolvedValue(null), clearUser: vi.fn().mockResolvedValue(undefined),
};
beforeEach(() => {
  vi.restoreAllMocks(); vi.clearAllMocks(); localStorage.clear();
  vi.spyOn(userContext, "useUser").mockReturnValue(readyStudentContext);
  vi.spyOn(api, "getRagStats").mockResolvedValue({ ready: false });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ notifications: [], unread_count: 0 }))));
  vi.spyOn(api, "listDiagnosticBlueprints").mockResolvedValue({ blueprints: [], next_after_id: null });
  vi.spyOn(api, "startDiagnostic");
});
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
const showStudent = () => render(<AccessibilityProvider><DiagnosticsPage /></AccessibilityProvider>);
const showStaff = () => render(<AccessibilityProvider><DiagnosticEditorPage /></AccessibilityProvider>);

it("requires a school without starting or listing assessments", async () => {
  vi.mocked(userContext.useUser).mockReturnValue({ ...readyStudentContext, user: { ...readyStudentContext.user!, organization_id: undefined } });
  showStudent();
  expect(await screen.findByRole("status")).toHaveTextContent(/school account required/i);
  expect(api.startDiagnostic).not.toHaveBeenCalled(); expect(api.listDiagnosticBlueprints).not.toHaveBeenCalled();
});

it("redirects anonymous users without calling the diagnostic API", async () => {
  vi.mocked(userContext.useUser).mockReturnValue({ ...readyStudentContext, user: null, auth: null });
  showStudent();
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/onboard"));
  expect(api.listDiagnosticBlueprints).not.toHaveBeenCalled();
});

it("waits for session readiness", () => {
  vi.mocked(userContext.useUser).mockReturnValue({ ...readyStudentContext, isReady: false });
  showStudent();
  expect(screen.getByRole("status")).toHaveTextContent(/restoring/i);
  expect(api.listDiagnosticBlueprints).not.toHaveBeenCalled(); expect(router.replace).not.toHaveBeenCalled();
});

it.each(["teacher", "parent", "admin"] as const)("denies %s the student page without an implicit administrator exception", async role => {
  vi.mocked(userContext.useUser).mockReturnValue({ ...readyStudentContext, user: { ...readyStudentContext.user!, role } });
  showStudent();
  await waitFor(() => expect(router.replace).toHaveBeenCalled());
  expect(api.listDiagnosticBlueprints).not.toHaveBeenCalled();
});

it("denies students the staff editor", async () => {
  showStaff();
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/chat"));
  expect(api.listDiagnosticBlueprints).not.toHaveBeenCalled();
});

it("renders the real assessment and student navigation with one main and page title", async () => {
  showStudent();
  expect(await screen.findByText(/your school has not published/i)).toBeVisible();
  expect(screen.getAllByRole("main")).toHaveLength(1);
  expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  expect(screen.getByRole("link", { name: "Diagnostics" })).toHaveAttribute("href", "/diagnostics");
  expect(screen.queryByRole("link", { name: "Diagnostic editor" })).not.toBeInTheDocument();
});

it.each(["teacher", "admin"] as const)("renders the staff editor/navigation for %s", async role => {
  vi.mocked(userContext.useUser).mockReturnValue({ ...readyStudentContext, user: { ...readyStudentContext.user!, role } });
  showStaff();
  expect(await screen.findByRole("heading", { level: 1, name: "Diagnostic editor" })).toBeVisible();
  expect(screen.getByRole("heading", { name: "Assessment setup" })).toBeVisible();
  expect(screen.getByRole("link", { name: "Diagnostic editor" })).toHaveAttribute("href", "/teacher/diagnostics");
});

it("does not render assessment content for an expired session", async () => {
  vi.mocked(userContext.useUser).mockReturnValue({ ...readyStudentContext, auth: { ...readyStudentContext.auth!, expires_at: "2020-01-01" } });
  showStudent();
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/onboard"));
  expect(api.listDiagnosticBlueprints).not.toHaveBeenCalled();
});

it("erases the diagnostic reference when a mounted session expires", async () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-15T10:00:00Z"));
  const owner = { user_id: 1, organization_id: 1, class_: "8" };
  saveDiagnosticResume(owner, "00000000-0000-4000-8000-000000000001");
  vi.spyOn(api, "getDiagnosticAttempt").mockReturnValue(new Promise(() => {}));
  vi.mocked(userContext.useUser).mockReturnValue({ ...readyStudentContext, auth: { ...readyStudentContext.auth!, expires_at: "2026-10-15T10:00:01Z" } });
  showStudent();
  await act(async () => { await vi.advanceTimersByTimeAsync(1001); });
  expect(screen.queryByRole("main")).not.toBeInTheDocument();
  expect(readDiagnosticResume(owner)).toBeNull();
});
