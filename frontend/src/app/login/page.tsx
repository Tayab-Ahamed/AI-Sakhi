"use client";

import { Suspense, useState } from "react";
import { motion } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import { useUser } from "@/lib/user-context";
import { getRoleLandingPage, ROLE_CONFIG } from "@/lib/auth";
import { api } from "@/lib/api";
import { Eye, EyeOff, ArrowLeft, ArrowRight } from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawRole = searchParams.get("role") || "student";
  const role = rawRole in ROLE_CONFIG ? rawRole : "student";
  const cfg = ROLE_CONFIG[role];

  const { setUser } = useUser();
  const [form, setForm] = useState({ name: "", password: "" });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.password) return;
    setLoading(true);
    setError("");
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res = await (api as any).login(form) as any;
      setUser(res, res.auth || null);
      router.push(getRoleLandingPage(res.role || role));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Invalid name or password.";
      // Try to extract backend detail from JSON error body
      try { const parsed = JSON.parse((err as Error).message); setError(parsed.detail || msg); } catch { setError(msg); }
    } finally {
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    background: "#111",
    border: "1px solid #2a2a2a",
    borderRadius: 12,
    padding: "12px 16px",
    fontSize: 14,
    fontFamily: "Inter, sans-serif",
    color: "white",
    outline: "none",
    boxSizing: "border-box",
    transition: "border-color 0.15s",
  };

  return (
    <div style={{ minHeight: "100vh", background: "#080808", display: "flex", fontFamily: "Inter, sans-serif" }}>

      {/* ── Left brand panel ── */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        style={{
          width: "42%",
          minWidth: 300,
          background: cfg.bg,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "56px 48px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* decorative circles */}
        <div style={{ position: "absolute", top: -80, left: -80, width: 280, height: 280, borderRadius: "50%", background: "rgba(255,255,255,0.06)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: -100, right: -60, width: 340, height: 340, borderRadius: "50%", background: "rgba(255,255,255,0.04)", pointerEvents: "none" }} />

        {/* Back button */}
        <button
          onClick={() => router.push("/")}
          style={{ position: "absolute", top: 24, left: 24, background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 10, padding: "8px 14px", cursor: "pointer", color: "white", fontSize: 13, display: "flex", alignItems: "center", gap: 6, fontFamily: "Inter, sans-serif", backdropFilter: "blur(6px)" }}
        >
          <ArrowLeft size={14} /> Back
        </button>

        <div style={{ fontSize: 72, marginBottom: 28, lineHeight: 1 }}>{cfg.emoji}</div>
        <div style={{ fontSize: 36, fontWeight: 900, color: "white", marginBottom: 14, letterSpacing: "-0.6px", lineHeight: 1.1 }}>
          {cfg.label}<br />Portal
        </div>
        <p style={{ fontSize: 16, color: "rgba(255,255,255,0.72)", lineHeight: 1.7, marginBottom: 40 }}>
          {cfg.tagline}
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "rgba(255,255,255,0.45)" }}>
          <span style={{ fontSize: 18 }}>🌸</span>
          AI Sakhi — Personalised Learning Platform
        </div>
      </motion.div>

      {/* ── Right form panel ── */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "48px 40px" }}>
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }} style={{ width: "100%", maxWidth: 420 }}>

          {/* Role badge */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 14px", borderRadius: 99, background: cfg.color + "18", border: `1px solid ${cfg.color}40`, marginBottom: 28 }}>
            <span style={{ fontSize: 14 }}>{cfg.emoji}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: cfg.color }}>{cfg.label} Portal</span>
          </div>

          <h1 style={{ fontSize: 30, fontWeight: 900, color: "white", marginBottom: 8, letterSpacing: "-0.5px" }}>Welcome back</h1>
          <p style={{ fontSize: 14, color: "#555", marginBottom: 32 }}>Sign in to your {cfg.label.toLowerCase()} account</p>

          {/* Error */}
          {error && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
              style={{ background: "#1a0808", border: "1px solid #dc262640", borderRadius: 12, padding: "12px 16px", marginBottom: 20, fontSize: 13, color: "#ef4444", lineHeight: 1.5 }}>
              {error}
            </motion.div>
          )}

          <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#666", display: "block", marginBottom: 8, letterSpacing: "0.03em" }}>NAME</label>
              <input
                style={inputStyle}
                placeholder="Enter your name"
                value={form.name}
                onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                autoFocus
                onFocus={(e) => { e.target.style.borderColor = cfg.color; }}
                onBlur={(e) => { e.target.style.borderColor = "#2a2a2a"; }}
              />
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#666", display: "block", marginBottom: 8, letterSpacing: "0.03em" }}>PASSWORD</label>
              <div style={{ position: "relative" }}>
                <input
                  style={{ ...inputStyle, paddingRight: 44 }}
                  type={showPw ? "text" : "password"}
                  placeholder="Enter your password"
                  value={form.password}
                  onChange={(e) => setForm(f => ({ ...f, password: e.target.value }))}
                  onFocus={(e) => { e.target.style.borderColor = cfg.color; }}
                  onBlur={(e) => { e.target.style.borderColor = "#2a2a2a"; }}
                />
                <button type="button" onClick={() => setShowPw(s => !s)}
                  style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#555", display: "flex" }}>
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !form.name.trim() || !form.password}
              style={{
                background: (loading || !form.name.trim() || !form.password) ? "#1a1a1a" : cfg.bg,
                color: (loading || !form.name.trim() || !form.password) ? "#444" : "white",
                border: "none",
                borderRadius: 14,
                padding: "15px",
                fontSize: 15,
                fontWeight: 700,
                cursor: (loading || !form.name.trim() || !form.password) ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                fontFamily: "Inter, sans-serif",
                marginTop: 4,
                transition: "all 0.2s",
              }}
            >
              {loading ? "Signing in…" : <><span>Sign In as {cfg.label}</span><ArrowRight size={16} /></>}
            </button>
          </form>

          <div style={{ marginTop: 32, paddingTop: 24, borderTop: "1px solid #161616", textAlign: "center" }}>
            <p style={{ fontSize: 13, color: "#444" }}>
              New here?{" "}
              <button
                onClick={() => router.push(`/onboard?role=${role}`)}
                style={{ background: "none", border: "none", color: cfg.color, fontWeight: 700, cursor: "pointer", fontSize: 13, fontFamily: "Inter, sans-serif" }}
              >
                Create {cfg.label} account →
              </button>
            </p>
            <p style={{ fontSize: 12, color: "#333", marginTop: 12 }}>
              Different role?{" "}
              <button
                onClick={() => router.push("/")}
                style={{ background: "none", border: "none", color: "#555", fontWeight: 600, cursor: "pointer", fontSize: 12, fontFamily: "Inter, sans-serif" }}
              >
                Go back to role selector
              </button>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: "100vh", background: "#080808", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontSize: 36 }}>🌸</div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
