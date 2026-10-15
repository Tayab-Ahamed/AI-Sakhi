import { beforeEach, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import Sidebar from "./Sidebar";

const mocks = vi.hoisted(() => ({ push: vi.fn(), setFontSize: vi.fn(), updateProfile: vi.fn(), clearUser: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: () => "/chat", useRouter: () => ({ push: mocks.push }) }));
vi.mock("@/lib/user-context", () => ({ useUser: () => ({ user: { user_id: 1, role: "student", name: "Learner", language: "English" }, updateProfile: mocks.updateProfile, clearUser: mocks.clearUser }) }));
vi.mock("@/lib/accessibility-context", () => ({ useAccessibility: () => ({ fontSize: "md", setFontSize: mocks.setFontSize, dyslexiaMode: false, toggleDyslexia: vi.fn() }) }));
vi.mock("@/lib/api", () => ({ api: { getRagStats: () => Promise.resolve({ ready: false }) } }));
vi.mock("@/components/NotificationCenter", () => ({ default: () => null }));
beforeEach(() => { vi.clearAllMocks(); });

it("labels language and text-size controls", async () => {
  render(<Sidebar />);
  await screen.findByText(/not loaded/i);
  expect(screen.getByRole("combobox", { name: "Language" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Large text" }));
  expect(mocks.setFontSize).toHaveBeenCalledWith("lg");
});
it("exposes mobile menu state and closes with Escape", async () => {
  render(<Sidebar />);
  await screen.findByText(/not loaded/i);
  const toggle = screen.getByRole("button", { name: "Open navigation" });
  expect(toggle).toHaveAttribute("aria-expanded", "false");
  fireEvent.click(toggle);
  expect(toggle).toHaveAttribute("aria-expanded", "true");
  fireEvent.keyDown(document, { key: "Escape" });
  expect(toggle).toHaveAttribute("aria-expanded", "false");
});
