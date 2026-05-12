"use client";

/**
 * Phase 9 — Accessibility Context
 *
 * Provides three global accessibility settings:
 *   - dyslexiaMode  : Apply OpenDyslexic font + larger line-height
 *   - reduceMotion  : Disable Framer Motion animations
 *   - fontSize      : "sm" | "md" | "lg" — scales the base font
 *
 * All settings are persisted to localStorage.
 */

import { createContext, useCallback, useContext, useEffect, useState } from "react";

type FontSize = "sm" | "md" | "lg";

type AccessibilityState = {
  dyslexiaMode: boolean;
  reduceMotion: boolean;
  fontSize: FontSize;
  toggleDyslexia: () => void;
  toggleReduceMotion: () => void;
  setFontSize: (size: FontSize) => void;
};

const STORAGE_KEYS = {
  dyslexia:     "sakhi_dyslexia",
  reduceMotion: "sakhi_reduce_motion",
  fontSize:     "sakhi_font_size",
} as const;

const FONT_SIZE_VALUES: Record<FontSize, string> = {
  sm: "13px",
  md: "15px",
  lg: "17px",
};

function readBool(key: string, defaultValue: boolean): boolean {
  if (typeof window === "undefined") return defaultValue;
  const raw = localStorage.getItem(key);
  return raw === null ? defaultValue : raw === "true";
}

function readFontSize(): FontSize {
  if (typeof window === "undefined") return "md";
  const raw = localStorage.getItem(STORAGE_KEYS.fontSize);
  return (raw === "sm" || raw === "lg") ? raw : "md";
}

const AccessibilityContext = createContext<AccessibilityState | null>(null);

export function AccessibilityProvider({ children }: { children: React.ReactNode }) {
  const [dyslexiaMode, setDyslexiaMode] = useState(() => readBool(STORAGE_KEYS.dyslexia, false));
  const [reduceMotion, setReduceMotion] = useState(() => readBool(STORAGE_KEYS.reduceMotion, false));
  const [fontSize, setFontSizeState] = useState<FontSize>(() => readFontSize());

  // Apply CSS changes on mount and whenever settings change
  useEffect(() => {
    const body = document.body;

    // Dyslexia mode
    if (dyslexiaMode) {
      body.classList.add("dyslexia-mode");
    } else {
      body.classList.remove("dyslexia-mode");
    }

    // Reduce motion
    if (reduceMotion) {
      body.classList.add("reduce-motion");
    } else {
      body.classList.remove("reduce-motion");
    }

    // Font size
    body.style.setProperty("--base-font-size", FONT_SIZE_VALUES[fontSize]);
    body.style.fontSize = FONT_SIZE_VALUES[fontSize];
  }, [dyslexiaMode, reduceMotion, fontSize]);

  const toggleDyslexia = useCallback(() => {
    setDyslexiaMode((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEYS.dyslexia, String(next));
      return next;
    });
  }, []);

  const toggleReduceMotion = useCallback(() => {
    setReduceMotion((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEYS.reduceMotion, String(next));
      return next;
    });
  }, []);

  const setFontSize = useCallback((size: FontSize) => {
    setFontSizeState(size);
    localStorage.setItem(STORAGE_KEYS.fontSize, size);
  }, []);

  return (
    <AccessibilityContext.Provider
      value={{ dyslexiaMode, reduceMotion, fontSize, toggleDyslexia, toggleReduceMotion, setFontSize }}
    >
      {children}
    </AccessibilityContext.Provider>
  );
}

export function useAccessibility(): AccessibilityState {
  const ctx = useContext(AccessibilityContext);
  if (!ctx) throw new Error("useAccessibility must be used within AccessibilityProvider");
  return ctx;
}
