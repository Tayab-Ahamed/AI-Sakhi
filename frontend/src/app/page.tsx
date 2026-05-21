"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useUser } from "@/lib/user-context";
import { getRoleLandingPage } from "@/lib/auth";

const ROLES = [
  {
    id: "student",
    label: "Student",
    emoji: "🎓",
    description: "Chat with AI Sakhi, take quizzes, and track your complete learning journey.",
    color: "#059669",
    border: "#059669",
    bg: "linear-gradient(135deg, #064e3b 0%, #0d9488 100%)",
    features: ["AI Chat Tutor", "Smart Quizzes", "Study Plans & Notes", "Flashcards & Streaks"],
  },
  {
    id: "teacher",
    label: "Teacher",
    emoji: "📚",
    description: "Create assignments, monitor student progress, and generate detailed class reports.",
    color: "#7c3aed",
    border: "#7c3aed",
    bg: "linear-gradient(135deg, #4c1d95 0%, #7c3aed 100%)",
    features: ["Assignment Creator", "Student Progress", "Submission Review", "AI Assistant"],
  },
  {
    id: "parent",
    label: "Parent",
    emoji: "👨‍👩‍👧",
    description: "Stay informed about your child's academic performance, streaks, and weak areas.",
    color: "#d97706",
    border: "#d97706",
    bg: "linear-gradient(135deg, #92400e 0%, #d97706 100%)",
    features: ["Progress Reports", "Quiz History", "Streak Tracking", "Weak Area Alerts"],
  },
  {
    id: "admin",
    label: "Admin",
    emoji: "🛡️",
    description: "Manage users and roles, view platform-wide analytics, and control org settings.",
    color: "#e11d48",
    border: "#e11d48",
    bg: "linear-gradient(135deg, #881337 0%, #e11d48 100%)",
    features: ["User Management", "Role Control", "Platform Analytics", "System Overview"],
  },
];

export default function Home() {
  const router = useRouter();
  const { user, isReady } = useUser();

  useEffect(() => {
    if (!isReady) return;
    if (user) {
      router.replace(getRoleLandingPage(user.role));
    }
  }, [isReady, router, user]);

  // Show splash while checking auth
  if (!isReady) {
    return (
      <div style={{ minHeight: "100vh", background: "#080808", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🌸</div>
          <p style={{ color: "#444", fontSize: 14 }}>Loading AI Sakhi…</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#080808", display: "flex", flexDirection: "column", fontFamily: "Inter, sans-serif" }}>

      {/* ── Header ── */}
      <header style={{ padding: "20px 40px", display: "flex", alignItems: "center", gap: 12, borderBottom: "1px solid #141414", position: "sticky", top: 0, background: "#080808", zIndex: 10 }}>
        <span style={{ fontSize: 26 }}>🌸</span>
        <span style={{ fontSize: 18, fontWeight: 800, color: "white", letterSpacing: "-0.3px" }}>AI Sakhi</span>
        <span style={{ marginLeft: "auto", fontSize: 12, color: "#444", letterSpacing: "0.04em" }}>NCERT · KG–Class 12 · 5 Languages</span>
      </header>

      {/* ── Hero ── */}
      <div style={{ textAlign: "center", padding: "72px 24px 56px" }}>
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: "easeOut" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 16px", borderRadius: 99, background: "#111", border: "1px solid #222", marginBottom: 28 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#059669", boxShadow: "0 0 8px #059669" }} />
            <span style={{ fontSize: 12, color: "#aaa", fontWeight: 600, letterSpacing: "0.05em" }}>INDIA'S AI LEARNING COMPANION</span>
          </div>
          <h1 style={{ fontSize: "clamp(32px, 6vw, 60px)", fontWeight: 900, color: "white", letterSpacing: "-1.5px", lineHeight: 1.1, marginBottom: 20 }}>
            Learn smarter.<br />
            <span style={{ background: "linear-gradient(90deg, #059669, #0d9488)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Every student. Every role.</span>
          </h1>
          <p style={{ fontSize: 18, color: "#666", maxWidth: 520, margin: "0 auto 8px", lineHeight: 1.7 }}>
            Personalised AI tutoring for students, actionable insights for teachers, and real-time tracking for parents.
          </p>
        </motion.div>
      </div>

      {/* ── Role selector prompt ── */}
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#444", letterSpacing: "0.1em", textTransform: "uppercase" }}>
          Select your role to sign in
        </span>
      </div>

      {/* ── Role cards ── */}
      <div style={{ flex: 1, padding: "0 32px 80px", maxWidth: 1120, margin: "0 auto", width: "100%" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(248px, 1fr))", gap: 20 }}>
          {ROLES.map((role, i) => (
            <motion.button
              key={role.id}
              initial={{ opacity: 0, y: 32 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 * i, duration: 0.5, ease: "easeOut" }}
              whileHover={{ scale: 1.025, y: -6 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => router.push(`/login?role=${role.id}`)}
              style={{
                background: "#0e0e0e",
                border: "1px solid #1c1c1c",
                borderRadius: 20,
                padding: "28px 26px",
                textAlign: "left",
                cursor: "pointer",
                fontFamily: "Inter, sans-serif",
                position: "relative",
                overflow: "hidden",
                transition: "border-color 0.2s, box-shadow 0.2s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = role.color;
                (e.currentTarget as HTMLElement).style.boxShadow = `0 0 30px ${role.color}18`;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = "#1c1c1c";
                (e.currentTarget as HTMLElement).style.boxShadow = "none";
              }}
            >
              {/* Background glow orb */}
              <div style={{ position: "absolute", top: -40, right: -40, width: 130, height: 130, borderRadius: "50%", background: role.bg, opacity: 0.12, pointerEvents: "none", filter: "blur(20px)" }} />

              <div style={{ fontSize: 40, marginBottom: 18, lineHeight: 1 }}>{role.emoji}</div>
              <div style={{ fontSize: 21, fontWeight: 800, color: "white", marginBottom: 10, letterSpacing: "-0.3px" }}>{role.label}</div>
              <p style={{ fontSize: 13, color: "#666", lineHeight: 1.65, marginBottom: 22 }}>{role.description}</p>

              <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 24 }}>
                {role.features.map((f) => (
                  <div key={f} style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 12, color: "#555" }}>
                    <div style={{ width: 5, height: 5, borderRadius: "50%", background: role.color, flexShrink: 0, boxShadow: `0 0 6px ${role.color}80` }} />
                    {f}
                  </div>
                ))}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, color: role.color }}>
                Sign in as {role.label}
                <span style={{ fontSize: 16 }}>→</span>
              </div>
            </motion.button>
          ))}
        </div>
      </div>

      {/* ── Footer ── */}
      <footer style={{ textAlign: "center", padding: "24px", borderTop: "1px solid #141414" }}>
        <p style={{ fontSize: 12, color: "#333", margin: 0 }}>Free · NCERT-aligned · KG to Class 12 · English, Hindi, Hinglish, Kannada, Tamil</p>
      </footer>
    </div>
  );
}
