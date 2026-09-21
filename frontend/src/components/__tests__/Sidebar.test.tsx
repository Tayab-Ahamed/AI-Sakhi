import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import Sidebar from "../Sidebar";
import React from "react";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  usePathname: () => "/chat",
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

// Mock user-context
vi.mock("@/lib/user-context", () => ({
  useUser: () => ({
    user: {
      name: "Rani",
      class_: "8",
      weak_subject: "Math",
      role: "student",
      language: "English",
      organization_name: "Demo School",
    },
    updateProfile: vi.fn(),
    clearUser: vi.fn(),
  }),
}));

// Mock accessibility-context
vi.mock("@/lib/accessibility-context", () => ({
  useAccessibility: () => ({
    dyslexiaMode: false,
    reduceMotion: false,
    fontSize: "md",
    toggleDyslexia: vi.fn(),
    toggleReduceMotion: vi.fn(),
    setFontSize: vi.fn(),
  }),
}));

// Mock api
vi.mock("@/lib/api", () => ({
  api: {
    getRagStats: vi.fn().mockResolvedValue({ ready: true, chunk_count: 150 }),
    clearChat: vi.fn(),
  },
}));

describe("Sidebar Component", () => {
  it("renders brand logo", () => {
    render(<Sidebar />);
    expect(screen.getByText("AI Sakhi")).toBeInTheDocument();
  });

  it("renders student profile metrics properly when signed in", () => {
    render(<Sidebar />);
    expect(screen.getByText("Rani")).toBeInTheDocument();
    expect(screen.getByText("Learning Goals")).toBeInTheDocument();
  });
});
