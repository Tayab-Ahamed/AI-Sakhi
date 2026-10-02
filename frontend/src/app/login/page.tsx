"use client";

import { Suspense, useState } from "react";
import { motion } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useUser } from "@/lib/user-context";
import { getRoleLandingPage, ROLE_CONFIG } from "@/lib/auth";
import { api } from "@/lib/api";
import { BrandMark } from "@/components/BrandMark";
import {
  ArrowRight,
  ArrowLeft,
  Eye,
  EyeSlash,
} from "@phosphor-icons/react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawRole = searchParams.get("role") || "student";
  const [selectedRole, setSelectedRole] = useState(rawRole in ROLE_CONFIG ? rawRole : "student");
  const cfg = ROLE_CONFIG[selectedRole] || ROLE_CONFIG.student;

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
      router.push(getRoleLandingPage(res.role || selectedRole));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Invalid name or password.";
      try {
        const parsed = JSON.parse((err as Error).message);
        setError(parsed.detail || msg);
      } catch {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="auth-page min-h-[100dvh] w-full flex flex-col items-center justify-center px-4 py-12 relative"
      style={{
        background: "#010102",
        color: "#f7f8f8",
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      {/* Back button */}
      <Link
        href="/"
        className="absolute top-6 left-6 inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
        style={{
          background: "#0f1011",
          border: "1px solid #23252a",
          color: "#8a8f98",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = "#f7f8f8";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = "#8a8f98";
        }}
      >
        <ArrowLeft size={14} /> Back to Home
      </Link>

      {/* Main card — Double Bezel */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.32, 0.72, 0, 1] }}
        className="auth-card w-full max-w-md"
        style={{
          padding: 6,
          background: "#0c0c0d",
          border: "1px solid #23252a",
          borderRadius: 24,
        }}
      >
        <div
          style={{
            background: "#0f1011",
            borderRadius: 19,
            border: "1px solid #1a1b1d",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
            padding: "2.5rem 2rem",
          }}
        >
          {/* Header */}
          <div className="flex flex-col items-center text-center mb-8">
            <BrandMark size="md" showLabel />

            <h1
              className="text-2xl font-bold tracking-tight mb-1"
              style={{ color: "#f7f8f8", letterSpacing: "-0.5px" }}
            >
              Sign in to AI Sakhi
            </h1>
            <p style={{ fontSize: 13, color: "#8a8f98" }}>{cfg.tagline}</p>

            {/* Role switcher pills */}
            <div
          className="auth-role-switcher flex items-center gap-1 p-1 rounded-full mt-5 max-w-full overflow-x-auto"
              style={{
                background: "#0c0c0d",
                border: "1px solid #1e2024",
              }}
            >
              {Object.entries(ROLE_CONFIG).map(([roleKey, roleVal]) => {
                const isSelected = selectedRole === roleKey;
                return (
                  <button
                    key={roleKey}
                    type="button"
                    onClick={() => {
                      setSelectedRole(roleKey);
                      setError("");
                    }}
                    className="px-3 py-1 rounded-full text-xs font-medium transition-all cursor-pointer whitespace-nowrap"
                    style={{
                      background: isSelected ? "rgba(94,106,210,0.2)" : "transparent",
                      color: isSelected ? "#828fff" : "#62666d",
                      border: isSelected ? "1px solid rgba(94,106,210,0.35)" : "1px solid transparent",
                    }}
                  >
                    {roleVal.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Error notice */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-5 p-3 rounded-lg text-xs"
              style={{
                background: "rgba(225,29,72,0.1)",
                border: "1px solid rgba(225,29,72,0.25)",
                color: "#f43f5e",
              }}
            >
              {error}
            </motion.div>
          )}

          {/* Form */}
          <form onSubmit={submit} className="flex flex-col gap-4">
            <div>
              <label
                className="block text-xs uppercase font-medium mb-1.5"
                style={{ color: "#62666d", letterSpacing: "0.04em" }}
              >
                Name
              </label>
              <input
                type="text"
                aria-label="Your name"
                placeholder="Enter your name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                autoFocus
                className="auth-field w-full px-3.5 py-2.5 rounded-lg text-sm transition-all outline-none"
                style={{
                  background: "#0c0c0d",
                  border: "1px solid #23252a",
                  color: "#f7f8f8",
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = "#5e6ad2";
                  e.target.style.boxShadow = "0 0 0 2px rgba(94,106,210,0.2)";
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = "#23252a";
                  e.target.style.boxShadow = "none";
                }}
              />
            </div>

            <div>
              <label
                className="block text-xs uppercase font-medium mb-1.5"
                style={{ color: "#62666d", letterSpacing: "0.04em" }}
              >
                Password
              </label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  aria-label="Password"
                  placeholder="Enter your password"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  className="auth-field w-full px-3.5 py-2.5 pr-10 rounded-lg text-sm transition-all outline-none"
                  style={{
                    background: "#0c0c0d",
                    border: "1px solid #23252a",
                    color: "#f7f8f8",
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = "#5e6ad2";
                    e.target.style.boxShadow = "0 0 0 2px rgba(94,106,210,0.2)";
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = "#23252a";
                    e.target.style.boxShadow = "none";
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPw((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer p-1"
                  style={{ color: "#62666d" }}
                  aria-label="Toggle password visibility"
                >
                  {showPw ? <EyeSlash size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !form.name.trim() || !form.password}
              className="auth-submit mt-2 flex items-center justify-center gap-2 py-3 px-4 rounded-lg text-sm font-medium transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: "#5e6ad2",
                color: "#ffffff",
              }}
              onMouseEnter={(e) => {
                if (!e.currentTarget.disabled) e.currentTarget.style.background = "#828fff";
              }}
              onMouseLeave={(e) => {
                if (!e.currentTarget.disabled) e.currentTarget.style.background = "#5e6ad2";
              }}
            >
              {loading ? (
                "Signing in..."
              ) : (
                <>
                  <span>Sign in as {cfg.label}</span>
                  <ArrowRight size={14} weight="bold" />
                </>
              )}
            </button>
          </form>

          {/* Footer links */}
          <div
            className="mt-6 pt-5 flex flex-col items-center gap-2 text-center text-xs"
            style={{ borderTop: "1px solid #1e2024" }}
          >
            <p style={{ color: "#62666d" }}>
              {selectedRole === "student" ? (
                <>New to AI Sakhi?{" "}<Link href="/onboard" className="font-medium hover:underline" style={{ color: "#5e6ad2" }}>Create a student account →</Link></>
              ) : (
                "Staff and guardian accounts are created by your school administrator."
              )}
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div
          className="min-h-screen flex items-center justify-center"
          style={{ background: "#010102" }}
        >
          <div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
