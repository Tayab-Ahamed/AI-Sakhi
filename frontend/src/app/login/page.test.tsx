import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import LoginPage from "./page";

const mocks = vi.hoisted(() => ({ isReady: false, push: vi.fn(), setUser: vi.fn(), login: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }), useSearchParams: () => new URLSearchParams() }));
vi.mock("@/lib/user-context", () => ({ useUser: () => ({ isReady: mocks.isReady, setUser: mocks.setUser }) }));
vi.mock("@/lib/api", () => ({ api: { login: mocks.login } }));
vi.mock("@phosphor-icons/react", () => ({ ArrowRight: () => null, ArrowLeft: () => null, Eye: () => null, EyeSlash: () => null }));
beforeEach(() => { vi.resetAllMocks(); mocks.isReady = false; });

describe("login hydration and trusted role", () => {
  it("should not accept input until the client and session initialization are ready", () => {
    const view = render(<LoginPage />);
    expect(screen.getByRole("textbox", { name: "Your name" })).toBeDisabled();
    expect(screen.getByLabelText("Password", { exact: true })).toBeDisabled();
    mocks.isReady = true; view.rerender(<LoginPage />);
    expect(screen.getByRole("textbox", { name: "Your name" })).toBeEnabled();
  });
  it("should route by the authenticated server role rather than the selected role", async () => {
    mocks.isReady = true;
    mocks.login.mockResolvedValue({ user_id: 2, role: "parent", auth: { expires_at: "2030-01-01" } });
    render(<LoginPage />);
    fireEvent.change(screen.getByRole("textbox", { name: "Your name" }), { target: { value: "Synthetic parent" } });
    fireEvent.change(screen.getByLabelText("Password", { exact: true }), { target: { value: "synthetic-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in as Student" }));
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/parent"));
    expect(mocks.setUser).toHaveBeenCalledOnce();
  });
  it("should announce rejected credentials and allow a retry", async () => {
    mocks.isReady = true; mocks.login.mockRejectedValue(new Error("Invalid credentials"));
    render(<LoginPage />);
    fireEvent.change(screen.getByRole("textbox", { name: "Your name" }), { target: { value: "Synthetic learner" } });
    fireEvent.change(screen.getByLabelText("Password", { exact: true }), { target: { value: "synthetic-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in as Student" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/invalid credentials/i);
    expect(mocks.setUser).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Sign in as Student" })).toBeEnabled();
  });
});
