"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, XCircle, X } from "lucide-react";

type ToastType = "success" | "error" | "info";
type Toast = { id: string; message: string; type: ToastType };
type ToastContextValue = {
  toast: (message: string, type?: ToastType) => void;
  success: (message: string) => void;
  error: (message: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counterRef = useRef(0);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((message: string, type: ToastType = "info") => {
    counterRef.current += 1;
    const id = `toast_${counterRef.current}`;
    setToasts((prev) => [...prev.slice(-4), { id, message, type }]);
    // Auto-dismiss after 4 s
    setTimeout(() => dismiss(id), 4000);
  }, [dismiss]);

  const success = useCallback((message: string) => toast(message, "success"), [toast]);
  const error = useCallback((message: string) => toast(message, "error"), [toast]);

  return (
    <ToastContext.Provider value={{ toast, success, error }}>
      {children}
      <div
        style={{
          position: "fixed",
          bottom: 24,
          right: 24,
          zIndex: 9999,
          display: "flex",
          flexDirection: "column",
          gap: 10,
          pointerEvents: "none",
        }}
      >
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 12, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "11px 16px",
                borderRadius: 12,
                fontSize: 13,
                fontWeight: 500,
                fontFamily: "Inter, sans-serif",
                boxShadow: "0 4px 20px rgba(0,0,0,0.13)",
                pointerEvents: "all",
                minWidth: 260,
                maxWidth: 380,
                background:
                  t.type === "error"
                    ? "#fef2f2"
                    : t.type === "success"
                    ? "#f0fdf4"
                    : "#f8fafc",
                border:
                  t.type === "error"
                    ? "1px solid #fecaca"
                    : t.type === "success"
                    ? "1px solid #bbf7d0"
                    : "1px solid #e2e8f0",
                color:
                  t.type === "error"
                    ? "#991b1b"
                    : t.type === "success"
                    ? "#065f46"
                    : "#1e293b",
              }}
            >
              {t.type === "error" ? (
                <XCircle size={16} style={{ flexShrink: 0, color: "#dc2626" }} />
              ) : (
                <CheckCircle2 size={16} style={{ flexShrink: 0, color: "#059669" }} />
              )}
              <span style={{ flex: 1 }}>{t.message}</span>
              <button
                onClick={() => dismiss(t.id)}
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  padding: 2,
                  color: "inherit",
                  opacity: 0.6,
                  flexShrink: 0,
                }}
              >
                <X size={13} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be inside ToastProvider");
  return ctx;
}
