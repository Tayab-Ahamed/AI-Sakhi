"use client";

import { Suspense, useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { useUser } from "@/lib/user-context";
import { api } from "@/lib/api";
import { Play, Pause, RotateCcw, Coffee, CheckCircle, Zap, BookOpen, MessageCircle, Bell } from "lucide-react";

const MODES = [
  { id: "focus",   label: "Focus",       minutes: 25, color: "#059669", bg: "#f0fdf4", desc: "Deep study session" },
  { id: "short",   label: "Short Break", minutes: 5,  color: "#0d9488", bg: "#f0fdfa", desc: "Stretch & breathe" },
  { id: "long",    label: "Long Break",  minutes: 15, color: "#2563eb", bg: "#eff6ff", desc: "Rest & recharge" },
];

const TIPS = [
  "Put your phone face-down. You've got this! 🌸",
  "One concept at a time. Small steps add up. ✨",
  "You're building a habit that will last a lifetime. 💪",
  "Focus is a skill — you get better at it every day. 🎯",
  "Take notes as you study — it deepens memory. 📝",
  "Confused? That's your brain growing. Keep going! 🧠",
  "Sakhi believes in you. Now you believe in yourself. 🌟",
];

function FocusTimerPageContent() {
  const { user } = useUser();
  const searchParams = useSearchParams();
  const studyTopic = searchParams.get("topic") || "";
  const [modeIdx, setModeIdx] = useState(0);
  const [timeLeft, setTimeLeft] = useState(MODES[0].minutes * 60);
  const [running, setRunning] = useState(false);
  const [completed, setCompleted] = useState(0);
  const [tipIdx, setTipIdx] = useState(0);
  const [showCelebrate, setShowCelebrate] = useState(false);
  const [notifGranted, setNotifGranted] = useState(() => (
    typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted"
  ));
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const mode = MODES[modeIdx];
  const total = mode.minutes * 60;
  const pct = ((total - timeLeft) / total) * 100;
  const radius = 88;
  const circ = 2 * Math.PI * radius;
  const dashOffset = circ - (pct / 100) * circ;

  // Request notification permission on mount
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission !== "granted" && Notification.permission !== "denied") {
        Notification.requestPermission().then((p) => setNotifGranted(p === "granted"));
      }
    }
  }, []);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  const switchMode = useCallback((idx: number) => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setRunning(false);
    setModeIdx(idx);
    setTimeLeft(MODES[idx].minutes * 60);
  }, []);

  const reset = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setRunning(false);
    setTimeLeft(mode.minutes * 60);
  }, [mode.minutes]);

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setTimeLeft((t) => {
          if (t <= 1) {
            clearInterval(intervalRef.current!);
            setRunning(false);
            if (modeIdx === 0) {
              setCompleted((c) => c + 1);
              setShowCelebrate(true);
              setTimeout(() => setShowCelebrate(false), 3500);
              // Log session to backend for study time analytics
              if (user?.user_id) {
                api.logSessionEnd({
                  user_id: user.user_id,
                  module: studyTopic ? `focus:${studyTopic}` : "focus_timer",
                  duration_seconds: MODES[0].minutes * 60,
                }).catch(() => {}); // silent — don't break the timer
              }
              // Browser notification
              if (notifGranted) {
                new Notification("🎉 Focus Session Complete!", {
                  body: studyTopic
                    ? `Great work on "${studyTopic}". Take a break!`
                    : `Session complete. Take a well-earned break! 🌸`,
                  icon: "/favicon.ico",
                });
              }
            }
            return 0;
          }
          return t - 1;
        });
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running, modeIdx, notifGranted, studyTopic]);

  // Rotate tips every 30 seconds while running
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setTipIdx((i) => (i + 1) % TIPS.length), 30000);
    return () => clearInterval(t);
  }, [running]);

  const xp = completed * 50;

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main-content" style={{ overflowY: "auto" }}>
        <div style={{ maxWidth: 680, margin: "0 auto", padding: "32px 24px" }}>

          {/* Header */}
          <div style={{ marginBottom: 28, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.3px" }}>Focus Timer</h1>
              <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                {studyTopic
                  ? <><span style={{ color: "var(--emerald)", fontWeight: 600 }}>Now studying:</span> {studyTopic}</>
                  : `25-minute deep work sessions for ${user?.weak_subject || "your studies"}`}
              </p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {!notifGranted && "Notification" in (typeof window !== "undefined" ? window : {}) && (
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => Notification.requestPermission().then((p) => setNotifGranted(p === "granted"))}
                  style={{ fontSize: 12 }}
                >
                  <Bell size={13} /> Enable Alerts
                </button>
              )}
              {completed > 0 && (
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: "var(--emerald)" }}>{xp} XP</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{completed} session{completed !== 1 ? "s" : ""} today</div>
                </div>
              )}
            </div>
          </div>

          {/* Mode switcher */}
          <div style={{ display: "flex", gap: 8, marginBottom: 28, background: "#f3f4f6", borderRadius: 12, padding: 4 }}>
            {MODES.map((m, i) => (
              <button
                key={m.id}
                onClick={() => switchMode(i)}
                style={{
                  flex: 1,
                  padding: "8px 0",
                  borderRadius: 9,
                  border: "none",
                  background: modeIdx === i ? "white" : "transparent",
                  boxShadow: modeIdx === i ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
                  fontWeight: modeIdx === i ? 700 : 500,
                  fontSize: 13,
                  color: modeIdx === i ? mode.color : "var(--text-secondary)",
                  cursor: "pointer",
                  transition: "all 0.2s",
                  fontFamily: "Inter, sans-serif",
                }}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* Timer ring */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 28 }}>
            <div style={{ position: "relative", width: 220, height: 220 }}>
              <svg width="220" height="220" style={{ transform: "rotate(-90deg)" }}>
                <circle cx="110" cy="110" r={radius} fill="none" stroke="#f0f0f0" strokeWidth="10" />
                <circle
                  cx="110" cy="110" r={radius}
                  fill="none"
                  stroke={mode.color}
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={circ}
                  strokeDashoffset={dashOffset}
                  style={{ transition: "stroke-dashoffset 0.9s ease, stroke 0.3s ease" }}
                />
              </svg>
              <div style={{
                position: "absolute", inset: 0,
                display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center",
              }}>
                <div style={{ fontSize: 46, fontWeight: 800, letterSpacing: "-2px", color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>
                  {formatTime(timeLeft)}
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, color: mode.color, textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 2 }}>
                  {mode.label}
                </div>
              </div>
            </div>

            {/* Controls */}
            <div style={{ display: "flex", gap: 12, marginTop: 20, alignItems: "center" }}>
              <button
                className="btn-icon"
                onClick={reset}
                title="Reset"
                style={{ width: 40, height: 40 }}
              >
                <RotateCcw size={16} />
              </button>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => setRunning((r) => !r)}
                style={{
                  width: 64, height: 64, borderRadius: "50%",
                  background: running ? "#fef2f2" : mode.color,
                  border: running ? "2px solid #fca5a5" : "none",
                  color: running ? "#dc2626" : "white",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer",
                  boxShadow: running ? "none" : `0 4px 14px ${mode.color}55`,
                  transition: "all 0.2s",
                  fontSize: 0,
                }}
              >
                {running ? <Pause size={24} /> : <Play size={24} style={{ marginLeft: 3 }} />}
              </motion.button>
              <div style={{ width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {modeIdx === 0 ? <BookOpen size={18} style={{ color: "var(--text-muted)" }} /> : <Coffee size={18} style={{ color: "var(--text-muted)" }} />}
              </div>
            </div>
          </div>

          {/* Tip card */}
          <AnimatePresence mode="wait">
            <motion.div
              key={running ? tipIdx : "idle"}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="card"
              style={{
                padding: "16px 20px",
                marginBottom: 16,
                background: mode.bg,
                border: `1px solid ${mode.color}33`,
                display: "flex",
                gap: 12,
                alignItems: "flex-start",
              }}
            >
              <div style={{ fontSize: 20, lineHeight: 1 }}>🌸</div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: mode.color, marginBottom: 2 }}>Sakhi says</div>
                <div style={{ fontSize: 13, color: "var(--text-primary)", lineHeight: 1.6 }}>
                  {running ? TIPS[tipIdx] : `${user?.name ? `Hey ${user.name}! ` : ""}Ready to focus? Hit play and let's get started. ${mode.desc}.`}
                </div>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Session badges */}
          {completed > 0 && (
            <div className="card" style={{ padding: "16px 20px", marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>Today&apos;s Sessions</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {Array.from({ length: completed }).map((_, i) => (
                  <div key={i} style={{ width: 32, height: 32, borderRadius: 8, background: "#f0fdf4", border: "1px solid #bbf7d0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>
                    ⭐
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick links */}
          <div style={{ display: "flex", gap: 10 }}>
            <Link href="/chat" className="btn btn-secondary btn-sm" style={{ flex: 1, justifyContent: "center" }}>
              <MessageCircle size={13} /> Ask Sakhi
            </Link>
            <Link href="/quiz" className="btn btn-primary btn-sm" style={{ flex: 1, justifyContent: "center" }}>
              <Zap size={13} /> Quick Quiz
            </Link>
          </div>
        </div>
      </main>

      {/* Celebration overlay */}
      <AnimatePresence>
        {showCelebrate && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            style={{
              position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
              background: "rgba(0,0,0,0.3)", zIndex: 1000, backdropFilter: "blur(4px)",
            }}
          >
            <div style={{ background: "white", borderRadius: 20, padding: "40px 48px", textAlign: "center", boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}>
              <div style={{ fontSize: 56, marginBottom: 12 }}>🎉</div>
              <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>Session Complete!</h2>
              <p style={{ color: "var(--text-secondary)", fontSize: 14, marginBottom: 20 }}>
                Amazing focus, {user?.name || "friend"}! You earned <strong style={{ color: "var(--emerald)" }}>+50 XP</strong>
              </p>
              <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
                <button className="btn btn-secondary btn-sm" onClick={() => { setShowCelebrate(false); switchMode(1); }}>
                  <Coffee size={13} /> Take a Break
                </button>
                <button className="btn btn-primary btn-sm" onClick={() => { setShowCelebrate(false); reset(); }}>
                  <CheckCircle size={13} /> Another Round
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function FocusTimerPage() {
  return (
    <Suspense fallback={null}>
      <FocusTimerPageContent />
    </Suspense>
  );
}
