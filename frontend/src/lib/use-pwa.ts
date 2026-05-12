"use client";

/**
 * Phase 11 — PWA Hook
 *
 * Handles:
 *  1. Service Worker registration
 *  2. beforeinstallprompt capture → exposes installPwa()
 *  3. Online/offline status → isOnline
 *  4. SW update detection → updateAvailable + applyUpdate()
 *  5. Background sync registration when coming back online
 */

import { useCallback, useEffect, useRef, useState } from "react";

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

const SYNC_QUEUE_TAG = "sakhi-sync-queue";

export function usePwa(): PwaState {
  const [isOnline, setIsOnline]           = useState(true);
  const [canInstall, setCanInstall]       = useState(false);
  const [isInstalled, setIsInstalled]     = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null);
  const newWorkerRef      = useRef<ServiceWorker | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // ── Initial online state ─────────────────────────────────
    setIsOnline(navigator.onLine);

    // ── Check if already installed (standalone mode) ─────────
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
    }

    // ── Online / offline events ──────────────────────────────
    const handleOnline = () => {
      setIsOnline(true);
      // Try to flush queued requests via Background Sync
      if ("serviceWorker" in navigator && "SyncManager" in window) {
        navigator.serviceWorker.ready
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .then((reg) => (reg as any).sync.register(SYNC_QUEUE_TAG))
          .catch(() => {});
      }
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
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .then((reg) => {
          // Detect updates
          reg.addEventListener("updatefound", () => {
            const newWorker = reg.installing;
            if (!newWorker) return;
            newWorkerRef.current = newWorker;
            newWorker.addEventListener("statechange", () => {
              if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                setUpdateAvailable(true);
              }
            });
          });
        })
        .catch(() => {});

      // If the page was controlled by a new SW after skipWaiting
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        window.location.reload();
      });
    }

    return () => {
      window.removeEventListener("online",  handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("beforeinstallprompt", handleInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
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
    const newWorker = newWorkerRef.current;
    if (newWorker) {
      newWorker.postMessage({ type: "SKIP_WAITING" });
    }
  }, []);

  return { isOnline, canInstall, isInstalled, updateAvailable, installPwa, applyUpdate };
}

// ─────────────────────────────────────────────────────────────
// Offline Quiz Cache helpers (localStorage)
// ─────────────────────────────────────────────────────────────

const QUIZ_CACHE_KEY = "sakhi_offline_quiz_cache";
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
    const existing: CachedQuiz[] = JSON.parse(localStorage.getItem(QUIZ_CACHE_KEY) || "[]");
    // Deduplicate by topic+difficulty
    const filtered = existing.filter(
      (q) => !(q.topic === quiz.topic && q.difficulty === quiz.difficulty)
    );
    const next = [quiz, ...filtered].slice(0, MAX_CACHED_QUIZZES);
    localStorage.setItem(QUIZ_CACHE_KEY, JSON.stringify(next));
  } catch {
    // localStorage quota or parse error — skip silently
  }
}

export function getOfflineCachedQuiz(
  topic: string,
  difficulty: string
): CachedQuiz | null {
  if (typeof window === "undefined") return null;
  try {
    const cached: CachedQuiz[] = JSON.parse(localStorage.getItem(QUIZ_CACHE_KEY) || "[]");
    return cached.find((q) => q.topic === topic && q.difficulty === difficulty) || cached[0] || null;
  } catch {
    return null;
  }
}

export function listOfflineCachedQuizzes(): CachedQuiz[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(QUIZ_CACHE_KEY) || "[]");
  } catch {
    return [];
  }
}
