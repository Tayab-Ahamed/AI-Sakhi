"use client";

/**
 * Phase 11 — PwaManager
 * Renders three non-intrusive UI elements:
 *   1. Offline status toast (bottom-left, slides in when offline)
 *   2. Install prompt banner (bottom-right, first visit after criteria met)
 *   3. Update available banner (top, unobtrusive)
 *
 * Mount once inside AppProviders. Uses usePwa() internally.
 */

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { usePwa } from "@/lib/use-pwa";
import { Download, WifiOff, RefreshCw, X } from "lucide-react";

const INSTALL_DISMISSED_KEY = "sakhi_pwa_install_dismissed";

export default function PwaManager() {
  const { isOnline, canInstall, isInstalled, updateAvailable, installPwa, applyUpdate } = usePwa();
  const [showInstall, setShowInstall] = useState(false);
  const [installDismissed, setInstallDismissed] = useState(true); // start hidden, set after mount

  // Only show install prompt if not previously dismissed
  useEffect(() => {
    const dismissed = localStorage.getItem(INSTALL_DISMISSED_KEY) === "true";
    setInstallDismissed(dismissed);
  }, []);

  useEffect(() => {
    if (canInstall && !isInstalled && !installDismissed) {
      // Slight delay so it doesn't appear immediately on load
      const t = setTimeout(() => setShowInstall(true), 3000);
      return () => clearTimeout(t);
    } else {
      setShowInstall(false);
    }
  }, [canInstall, isInstalled, installDismissed]);

  const dismissInstall = () => {
    setShowInstall(false);
    setInstallDismissed(true);
    localStorage.setItem(INSTALL_DISMISSED_KEY, "true");
  };

  const handleInstall = async () => {
    await installPwa();
    setShowInstall(false);
  };

  return (
    <>
      {/* ── Offline Toast ─────────────────────────────────── */}
      <AnimatePresence>
        {!isOnline && (
          <motion.div
            key="offline-toast"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            style={{
              position: "fixed",
              bottom: 24,
              left: 24,
              zIndex: 9999,
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "12px 18px",
              background: "#1c1c1e",
              color: "white",
              borderRadius: 14,
              fontSize: 13,
              fontWeight: 500,
              boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
              maxWidth: 320,
              fontFamily: "Inter, sans-serif",
            }}
          >
            <WifiOff size={16} style={{ color: "#f97316", flexShrink: 0 }} />
            <div>
              <div style={{ fontWeight: 700, marginBottom: 1 }}>You&apos;re offline</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.65)" }}>
                Quiz cache &amp; saved content still available
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Install Prompt ────────────────────────────────── */}
      <AnimatePresence>
        {showInstall && (
          <motion.div
            key="install-prompt"
            initial={{ opacity: 0, y: 20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20 }}
            style={{
              position: "fixed",
              bottom: 24,
              right: 24,
              zIndex: 9999,
              background: "white",
              border: "1.5px solid #e5e7eb",
              borderRadius: 18,
              padding: "18px 20px",
              boxShadow: "0 12px 36px rgba(0,0,0,0.12)",
              maxWidth: 300,
              fontFamily: "Inter, sans-serif",
            }}
          >
            <button
              onClick={dismissInstall}
              style={{
                position: "absolute", top: 10, right: 10,
                background: "none", border: "none", cursor: "pointer",
                color: "#9ca3af", padding: 4,
              }}
            >
              <X size={14} />
            </button>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 12,
                background: "linear-gradient(135deg, #d1fae5, #34d399)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 20, flexShrink: 0,
              }}>S</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: "#1c1c1e" }}>Install AI Sakhi</div>
                <div style={{ fontSize: 12, color: "#6b7280" }}>Study offline, anytime</div>
              </div>
            </div>
            <p style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5, marginBottom: 14 }}>
              Add AI Sakhi to your home screen for instant access — even without internet.
            </p>
            <button
              onClick={() => void handleInstall()}
              style={{
                width: "100%", padding: "9px 0",
                background: "#059669", color: "white",
                border: "none", borderRadius: 10,
                fontWeight: 600, fontSize: 13,
                cursor: "pointer", display: "flex",
                alignItems: "center", justifyContent: "center", gap: 6,
                fontFamily: "Inter, sans-serif",
              }}
            >
              <Download size={14} /> Install App
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Update Available Banner ───────────────────────── */}
      <AnimatePresence>
        {updateAvailable && (
          <motion.div
            key="update-banner"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            style={{
              position: "fixed",
              top: 0, left: 0, right: 0,
              zIndex: 9999,
              background: "#0d9488",
              color: "white",
              padding: "8px 16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
              fontSize: 13,
              fontWeight: 500,
              fontFamily: "Inter, sans-serif",
            }}
          >
            <RefreshCw size={14} />
            A new version of AI Sakhi is available.
            <button
              onClick={applyUpdate}
              style={{
                background: "rgba(255,255,255,0.2)",
                border: "1px solid rgba(255,255,255,0.35)",
                color: "white",
                padding: "4px 12px",
                borderRadius: 8,
                cursor: "pointer",
                fontWeight: 700,
                fontSize: 12,
                fontFamily: "Inter, sans-serif",
              }}
            >
              Refresh Now
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
