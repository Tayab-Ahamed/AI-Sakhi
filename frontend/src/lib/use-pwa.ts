"use client";

/**
 * Phase 11 — PWA Hook
 *
 * Handles:
 *  1. Service Worker registration
 *  2. beforeinstallprompt capture → exposes installPwa()
 *  3. Online/offline status → isOnline
 *  4. SW update detection → updateAvailable + applyUpdate()
 * Private writes are not replayed by the service worker.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { observeWorkerUpdates } from "./pwa-updates";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export type PwaState = {
  isOnline: boolean;
  canInstall: boolean;
  isInstalled: boolean;
  updateAvailable: boolean;
  installPwa: () => Promise<void>;
  applyUpdate: () => void;
};

export function usePwa(): PwaState {
  const [isOnline, setIsOnline]           = useState(() => (typeof navigator !== "undefined" ? navigator.onLine : true));
  const [canInstall, setCanInstall]       = useState(false);
  const [isInstalled, setIsInstalled]     = useState(() => (typeof window !== "undefined" && window.matchMedia("(display-mode: standalone)").matches));
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null);
  const updatesRef = useRef<ReturnType<typeof observeWorkerUpdates> | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;


    // ── Online / offline events ──────────────────────────────
    const handleOnline = () => {
      setIsOnline(true);
    };
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online",  handleOnline);
    window.addEventListener("offline", handleOffline);

    // ── Install prompt capture ───────────────────────────────
    const handleInstallPrompt = (e: Event) => {
      e.preventDefault();
      deferredPromptRef.current = e as BeforeInstallPromptEvent;
      setCanInstall(true);
    };
    window.addEventListener("beforeinstallprompt", handleInstallPrompt);

    // ── Track if user installs from browser chrome ───────────
    const handleInstalled = () => {
      setCanInstall(false);
      setIsInstalled(true);
      deferredPromptRef.current = null;
    };
    window.addEventListener("appinstalled", handleInstalled);

    // ── Register Service Worker ──────────────────────────────
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      updatesRef.current = observeWorkerUpdates(
        navigator.serviceWorker, () => setUpdateAvailable(true), () => window.location.reload(),
      );
    }

    return () => {
      window.removeEventListener("online",  handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("beforeinstallprompt", handleInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
      updatesRef.current?.dispose();
      updatesRef.current = null;
    };
  }, []);

  const installPwa = useCallback(async () => {
    const prompt = deferredPromptRef.current;
    if (!prompt) return;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === "accepted") {
      setCanInstall(false);
      setIsInstalled(true);
    }
    deferredPromptRef.current = null;
  }, []);

  const applyUpdate = useCallback(() => {
    updatesRef.current?.applyUpdate();
  }, []);

  return { isOnline, canInstall, isInstalled, updateAvailable, installPwa, applyUpdate };
}

// ─────────────────────────────────────────────────────────────
// Offline Quiz Cache helpers (localStorage)
// ─────────────────────────────────────────────────────────────

const QUIZ_CACHE_KEY = "sakhi_offline_quiz_cache";
const CURRICULUM_VERSION = "2026-10-07";

function quizCacheKey(): string | null {
  try {
    const user = JSON.parse(localStorage.getItem("sakhi_user") || "null") as { user_id: number; organization_id?: number } | null;
    return user ? `${QUIZ_CACHE_KEY}:${user.organization_id || 0}:${user.user_id}:${CURRICULUM_VERSION}` : null;
  } catch { return null; }
}
const MAX_CACHED_QUIZZES = 5;

export type CachedQuiz = {
  topic: string;
  difficulty: string;
  class_: string;
  language: string;
  questions: object[];
  cachedAt: string;
};

export function saveQuizToOfflineCache(quiz: CachedQuiz) {
  if (typeof window === "undefined") return;
  try {
    const key = quizCacheKey();
    if (!key) return;
    localStorage.removeItem(QUIZ_CACHE_KEY);
    const existing: CachedQuiz[] = JSON.parse(localStorage.getItem(key) || "[]");
    // Deduplicate by topic+difficulty
    const filtered = existing.filter(
      (q) => !(q.topic === quiz.topic && q.difficulty === quiz.difficulty && q.class_ === quiz.class_ && q.language === quiz.language)
    );
    const next = [quiz, ...filtered].slice(0, MAX_CACHED_QUIZZES);
    localStorage.setItem(key, JSON.stringify(next));
  } catch {
    // localStorage quota or parse error — skip silently
  }
}

export function getOfflineCachedQuiz(
  topic: string,
  difficulty: string,
  classLevel: string,
  language: string
): CachedQuiz | null {
  if (typeof window === "undefined") return null;
  try {
    const key = quizCacheKey();
    if (!key) return null;
    const cached: CachedQuiz[] = JSON.parse(localStorage.getItem(key) || "[]");
    return cached.find((q) => q.topic === topic && q.difficulty === difficulty && q.class_ === classLevel && q.language === language) || null;
  } catch {
    return null;
  }
}

export function listOfflineCachedQuizzes(): CachedQuiz[] {
  if (typeof window === "undefined") return [];
  try {
    const key = quizCacheKey();
    return key ? JSON.parse(localStorage.getItem(key) || "[]") : [];
  } catch {
    return [];
  }
}
