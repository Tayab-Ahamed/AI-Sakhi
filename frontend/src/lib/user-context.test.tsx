import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { UserProvider, useUser } from "./user-context";
import { ApiError } from "./api";

const mocks = vi.hoisted(() => ({ getSession: vi.fn(), getUser: vi.fn(), logout: vi.fn() }));
vi.mock("./api", async (original) => ({ ...await original<object>(), api: mocks }));

const user = { user_id: 1, name: "Asha", class_: "8", language: "English", role: "student", weak_subject: "Math" };
const auth = { user_id: 1, expires_at: "2030-01-01", token_type: "Cookie" };
function SessionProbe() {
  const context = useUser();
  return <><p>{!context.isReady ? "Loading" : context.user?.name || "Signed out"}</p><button type="button" onClick={() => void context.clearUser()}>Sign out</button></>;
}
beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear(); sessionStorage.clear();
  mocks.getSession.mockResolvedValue({ user, auth }); mocks.getUser.mockResolvedValue(user); mocks.logout.mockResolvedValue({ ok: true });
});

describe("cookie session lifecycle", () => {
  it("restores the server-confirmed session without retaining a legacy JWT", async () => {
    localStorage.setItem("sakhi_auth", JSON.stringify({ ...auth, token: "private-legacy-jwt" }));
    render(<UserProvider><SessionProbe /></UserProvider>);
    expect(await screen.findByText("Asha")).toBeInTheDocument();
    expect(localStorage.getItem("sakhi_auth")).not.toContain("private-legacy-jwt");
  });
  it("does not restore a cookie before completing a pending logout", async () => {
    localStorage.setItem("sakhi_logout_pending", "true");
    render(<UserProvider><SessionProbe /></UserProvider>);
    expect(await screen.findByText("Signed out")).toBeInTheDocument();
    expect(mocks.logout).toHaveBeenCalledOnce(); expect(mocks.getSession).not.toHaveBeenCalled();
    expect(localStorage.getItem("sakhi_logout_pending")).toBeNull();
  });
  it("clears a pending logout when the server session is already expired", async () => {
    localStorage.setItem("sakhi_logout_pending", "true");
    mocks.logout.mockRejectedValueOnce(new ApiError("Expired", 401));
    render(<UserProvider><SessionProbe /></UserProvider>);
    await screen.findByText("Signed out");
    expect(localStorage.getItem("sakhi_logout_pending")).toBeNull();
  });
  it("erases cached credentials and account metadata after server revocation", async () => {
    localStorage.setItem("sakhi_user", JSON.stringify(user)); localStorage.setItem("sakhi_auth", JSON.stringify(auth));
    mocks.getSession.mockRejectedValueOnce(new ApiError("Revoked", 401));
    render(<UserProvider><SessionProbe /></UserProvider>);
    await screen.findByText("Signed out");
    expect(localStorage.getItem("sakhi_user")).toBeNull(); expect(localStorage.getItem("sakhi_auth")).toBeNull();
  });
  it("removes device metadata on logout and keeps a revocation marker when offline", async () => {
    render(<UserProvider><SessionProbe /></UserProvider>);
    await screen.findByText("Asha");
    mocks.logout.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    await waitFor(() => expect(localStorage.getItem("sakhi_user")).toBeNull());
    expect(localStorage.getItem("sakhi_logout_pending")).toBe("true");
  });
});
