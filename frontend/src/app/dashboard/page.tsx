"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import html2canvas from "html2canvas";

import Sidebar from "@/components/Sidebar";
import { api } from "@/lib/api";
import { useUser } from "@/lib/user-context";
import { Star, Trophy, Target, BookOpen, Zap, TrendingUp, Calendar, MessageCircle, Download, ShieldCheck, Users, Clock, Lightbulb, Sparkles, ArrowRight } from "lucide-react";

type DashboardMetrics = {
  total_users: number;
  active_users_7d: number;
  total_quiz_attempts: number;
  total_chat_sessions: number;
  total_events: number;
  average_quiz_score_pct: number;
  roles: Record<string, number>;
  languages: Array<{ language: string; count: number }>;
  top_events: Array<{ event_type: string; count: number }>;
  users: Array<Record<string, unknown>>;
};

type StudentReport = {
  weak_topics: string[];
  recent_history: Array<{ topic: string; score: number; total: number; timestamp: string }>;
};

type Recommendation = {
  topic: string;
  subject: string;
  subject_id: string;
  reason: string;
};

type RetryTopic = {
  topic: string;
  subject: string;
  subject_id: string;
  score_pct: number;
  reason: string;
};

type SavedArtifact = {
  id: number;
  artifact_type: string;
  title: string;
  topic?: string;
  created_at: string;
  payload: Record<string, unknown>;
};

type HistoryItem = { topic: string; score: number; total: number; timestamp: string };

function getBadges(streak: number, quizCount: number, history: HistoryItem[]) {
  const hasPerfect = history.some((h) => h.score === h.total && h.total > 0);
  const uniqueTopics = new Set(history.map((h) => h.topic)).size;
  return [
    { icon: "🎯", name: "First Quiz",   desc: "Completed your first quiz",  earned: quizCount >= 1 },
    { icon: "🔥", name: "On Fire",       desc: "3-day streak",               earned: streak >= 3 },
    { icon: "⭐", name: "Perfect Score", desc: "100% on a quiz",             earned: hasPerfect },
    { icon: "🏆", name: "Week Warrior",  desc: "7-day streak",               earned: streak >= 7 },
    { icon: "🌈", name: "Explorer",      desc: "Tried 5 different topics",   earned: uniqueTopics >= 5 },
    { icon: "📚", name: "Scholar",       desc: "Completed 10 quizzes",       earned: quizCount >= 10 },
  ];
}
// ────── Sakhi Nudge Banner ──────
function SakhiNudgeBanner({
  streak, weakTopics, dueFlashcards, userName,
}: { streak: number; weakTopics: string[]; dueFlashcards: number; userName?: string }) {
  let emoji = "📚";
  let message = "Sakhi's ready when you are. Pick a topic and let's go!";
  let href = "/quiz";
  let btnLabel = "Start Learning";

  if (streak === 0 && weakTopics.length > 0) {
    emoji = "💪";
    message = `Hey${userName ? " " + userName : ""}! Let's get back on track. Revise ${weakTopics[0]} today.`;
    href = `/study-plan?topic=${encodeURIComponent(weakTopics[0])}`;
    btnLabel = "Revise Now";
  } else if (dueFlashcards > 0) {
    emoji = "🗂️";
    message = `You have ${dueFlashcards} flashcard${dueFlashcards !== 1 ? "s" : ""} due for review today. A quick 5-min session builds long-term memory!`;
    href = "/flashcards";
    btnLabel = "Review Now";
  } else if (weakTopics.length > 0) {
    emoji = "💡";
    message = `${weakTopics[0]} needs some love. Even 10 minutes of revision makes a big difference!`;
    href = `/study-plan?topic=${encodeURIComponent(weakTopics[0])}`;
    btnLabel = "Make a Plan";
  } else if (streak >= 7) {
    emoji = "🏆";
    message = `Incredible! ${streak}-day streak${userName ? ", " + userName : ""}! You\'re unstoppable. Keep this momentum going!`;
    href = "/quiz";
    btnLabel = "Continue Streak";
  } else if (streak >= 3) {
    emoji = "🔥";
    message = `${streak}-day streak! You\'re on fire${userName ? ", " + userName : ""}. Keep showing up every day — it compounds!`;
    href = "/quiz";
    btnLabel = "Keep Going";
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      style={{
        background: "linear-gradient(135deg, #064e3b 0%, #0d9488 60%, #0e7490 100%)",
        borderRadius: "var(--radius-xl)",
        padding: "18px 24px",
        marginBottom: 20,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        color: "white",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Background glow */}
      <div style={{ position: "absolute", top: -30, right: 80, width: 140, height: 140, borderRadius: "50%", background: "rgba(255,255,255,0.05)", pointerEvents: "none" }} />
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ fontSize: 28, lineHeight: 1, flexShrink: 0 }}>{emoji}</div>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.6)", marginBottom: 3 }}>
            <Sparkles size={10} style={{ display: "inline", marginRight: 4 }} />Sakhi&apos;s Nudge
          </div>
          <p style={{ fontSize: 14, fontWeight: 500, color: "rgba(255,255,255,0.92)", lineHeight: 1.5, margin: 0 }}>{message}</p>
        </div>
      </div>
      <Link href={href} className="btn btn-sm" style={{ background: "rgba(255,255,255,0.15)", color: "white", border: "1px solid rgba(255,255,255,0.25)", backdropFilter: "blur(6px)", whiteSpace: "nowrap", flexShrink: 0 }}>
        {btnLabel} <ArrowRight size={13} />
      </Link>
    </motion.div>
  );
}

// ────── What to Study Next Card ──────
function WhatToStudyNext({ recommendations, retryTopic }: { recommendations: Recommendation[]; retryTopic: RetryTopic | null }) {
  if (recommendations.length === 0 && !retryTopic) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="card"
      style={{ padding: 22, marginBottom: 16, border: "1px solid #e0f2fe", background: "#f0f9ff" }}
    >
      <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
        <Sparkles size={16} style={{ color: "#0ea5e9" }} /> What to Study Next
      </h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {retryTopic && (
          <Link
            href={`/quiz?topic=${encodeURIComponent(retryTopic.topic)}`}
            style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "10px 14px", borderRadius: "var(--radius-md)",
              background: "#fff7ed", border: "1px solid #fed7aa",
              textDecoration: "none",
            }}
          >
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#9a3412", marginBottom: 2 }}>🔁 Retry: {retryTopic.topic}</div>
              <div style={{ fontSize: 12, color: "#c2410c" }}>{retryTopic.reason}</div>
            </div>
            <ArrowRight size={14} style={{ color: "#c2410c", flexShrink: 0 }} />
          </Link>
        )}
        {recommendations.map((rec) => (
          <Link
            key={rec.topic}
            href={`/quiz?topic=${encodeURIComponent(rec.topic)}`}
            style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "10px 14px", borderRadius: "var(--radius-md)",
              background: "white", border: "1px solid #bae6fd",
              textDecoration: "none",
              transition: "box-shadow 0.15s",
            }}
          >
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 2 }}>{rec.topic}</div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{rec.subject} · {rec.reason}</div>
            </div>
            <ArrowRight size={14} style={{ color: "#0ea5e9", flexShrink: 0 }} />
          </Link>
        ))}
      </div>
    </motion.div>
  );
}


function StatCard({ icon: Icon, label, value, iconBg, iconColor }: {
  icon: React.ElementType; label: string; value: string | number; iconBg: string; iconColor: string;
}) {
  return (
    <div className="card" style={{ padding: 20 }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, background: iconBg, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
        <Icon size={17} style={{ color: iconColor }} />
      </div>
      <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.5px", color: "var(--text-primary)", marginBottom: 2 }}>{value}</div>
      <div style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 500 }}>{label}</div>
    </div>
  );
}

// ────── Activity Heatmap ──────
function ActivityHeatmap({ history }: { history: HistoryItem[] }) {
  const DAYS = 91; // 13 weeks
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Build a map: dateStr -> count
  const activityMap: Record<string, number> = {};
  history.forEach((h) => {
    const d = new Date(h.timestamp);
    d.setHours(0, 0, 0, 0);
    const key = d.toISOString().slice(0, 10);
    activityMap[key] = (activityMap[key] || 0) + 1;
  });

  // Build array of DAYS days ending today
  const cells: Array<{ date: Date; count: number }> = [];
  for (let i = DAYS - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    cells.push({ date: d, count: activityMap[key] || 0 });
  }

  const getColor = (count: number) => {
    if (count === 0) return "#f0f0f0";
    if (count === 1) return "#bbf7d0";
    if (count === 2) return "#6ee7b7";
    return "#059669";
  };

  // Group into weeks of 7 columns
  const weeks: typeof cells[] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }

  const totalActive = Object.values(activityMap).filter((v) => v > 0).length;

  return (
    <div className="card" style={{ padding: 22, marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
          <Calendar size={16} style={{ color: "var(--emerald)" }} /> Activity Heatmap
        </h2>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{totalActive} active days in last 13 weeks</span>
      </div>

      <div style={{ overflowX: "auto" }}>
        <div style={{ display: "flex", gap: 3, minWidth: "fit-content" }}>
          {weeks.map((week, wi) => (
            <div key={wi} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              {week.map((cell, di) => (
                <div
                  key={di}
                  title={`${cell.date.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}: ${cell.count} quiz${cell.count !== 1 ? "zes" : ""}`}
                  style={{
                    width: 12, height: 12,
                    borderRadius: 3,
                    background: getColor(cell.count),
                    transition: "transform 0.1s",
                    cursor: cell.count > 0 ? "pointer" : "default",
                  }}
                  onMouseEnter={(e) => { (e.target as HTMLElement).style.transform = "scale(1.4)"; }}
                  onMouseLeave={(e) => { (e.target as HTMLElement).style.transform = "scale(1)"; }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10 }}>
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Less</span>
        {["#f0f0f0", "#bbf7d0", "#6ee7b7", "#059669"].map((c) => (
          <div key={c} style={{ width: 10, height: 10, borderRadius: 2, background: c }} />
        ))}
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>More</span>
      </div>
    </div>
  );
}

// ────── Daily Goal ──────
const GOAL_KEY = "sakhi_daily_goal";

function readSavedGoal(userId?: number) {
  if (typeof window === "undefined") return "";
  const raw = localStorage.getItem(`${GOAL_KEY}_${userId}`);
  if (!raw) return "";
  try {
    const parsed = JSON.parse(raw) as { date?: string; goal?: string };
    const today = new Date().toISOString().slice(0, 10);
    return parsed.date === today ? parsed.goal || "" : "";
  } catch {
    return "";
  }
}

function DailyGoalCard({ userId, weakSubject }: { userId?: number; weakSubject?: string }) {
  const [goal, setGoal] = useState("");
  const [saved, setSaved] = useState(() => readSavedGoal(userId));
  const [editing, setEditing] = useState(false);

  const saveGoal = () => {
    if (!goal.trim()) return;
    const entry = { date: new Date().toISOString().slice(0, 10), goal: goal.trim() };
    localStorage.setItem(`${GOAL_KEY}_${userId}`, JSON.stringify(entry));
    setSaved(goal.trim());
    setGoal("");
    setEditing(false);
  };

  if (saved && !editing) {
    return (
      <div className="card" style={{ padding: 22, border: "1px solid #bbf7d0", background: "#f0fdf4", marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4, display: "flex", alignItems: "center", gap: 8 }}>
              <Target size={16} style={{ color: "var(--emerald)" }} /> Today&apos;s Goal
            </h2>
            <p style={{ fontSize: 14, color: "var(--text-primary)", fontWeight: 600 }}>📌 {saved}</p>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => { setEditing(true); setGoal(saved); }}>Change</button>
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <Link href="/chat" className="btn btn-primary btn-sm" style={{ justifyContent: "center", flex: 1 }}>
            <MessageCircle size={13} /> Chat with Sakhi
          </Link>
          <Link href="/quiz" className="btn btn-secondary btn-sm" style={{ justifyContent: "center", flex: 1 }}>
            <Zap size={13} /> Take a Quiz
          </Link>
          <Link href="/focus-timer" className="btn btn-secondary btn-sm" style={{ justifyContent: "center", flex: 1 }}>
            <Clock size={13} /> Focus Timer
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: 22, border: "1px solid #e5e7eb", marginBottom: 16 }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 6, display: "flex", alignItems: "center", gap: 8 }}>
        <Target size={16} style={{ color: "var(--emerald)" }} /> Set Today&apos;s Goal
      </h2>
      <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 14 }}>
        What will you focus on today? Locking in a goal makes you 3× more likely to study.
      </p>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          className="input"
          placeholder={`e.g. "Finish ${weakSubject || "Photosynthesis"} chapter"`}
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && saveGoal()}
          autoFocus={editing}
        />
        <button className="btn btn-primary" onClick={saveGoal} disabled={!goal.trim()} style={{ whiteSpace: "nowrap" }}>
          Lock In 🎯
        </button>
      </div>
    </div>
  );
}

const TIPS = [
  "Consistency beats intensity. 10 minutes of learning every day compounds into massive success!",
  "Make a mistake? Perfect! That is your brain building new neural connections. Keep going!",
  "Don't study until you get it right; study until you can't get it wrong. Sakhi is here to help!",
  "Your weak subjects are just areas of opportunity waiting to be unlocked. Let's conquer them!",
  "Taking a quick 5-minute break every 25 minutes keeps your brain sharp and information retained.",
];

function WeeklyStreakCalendar({ history }: { history: HistoryItem[] }) {
  const days = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const activeDates = new Set(
    history.map((h) => {
      const d = new Date(h.timestamp);
      d.setHours(0, 0, 0, 0);
      return d.toISOString().slice(0, 10);
    })
  );

  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const hasQuiz = activeDates.has(dateStr);
    days.push({
      date: d,
      name: d.toLocaleDateString("en-US", { weekday: "short" }),
      dayNum: d.getDate(),
      active: hasQuiz,
      isToday: i === 0,
    });
  }

  return (
    <div className="card" style={{ padding: 20, marginBottom: 16 }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
        <Calendar size={16} style={{ color: "var(--emerald)" }} /> Weekly Streak Consistency
      </h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 10 }}>
        {days.map((day, idx) => (
          <div
            key={idx}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              padding: "10px 4px",
              borderRadius: "var(--radius-md)",
              background: day.active
                ? "linear-gradient(135deg, rgba(6, 78, 59, 0.1), rgba(13, 148, 136, 0.1))"
                : day.isToday
                ? "var(--bg-app)"
                : "transparent",
              border: day.isToday ? "1px solid var(--emerald)" : "1px solid transparent",
            }}
          >
            <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, marginBottom: 6 }}>
              {day.name}
            </span>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: day.active
                  ? "linear-gradient(135deg, #064e3b, #0d9488)"
                  : "var(--bg-surface)",
                border: day.active ? "none" : "1.5px solid var(--border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: day.active ? "white" : "var(--text-muted)",
                fontSize: 13,
                fontWeight: 700,
                boxShadow: day.active ? "0 4px 10px rgba(13, 148, 136, 0.2)" : "none",
              }}
            >
              {day.active ? "🔥" : day.dayNum}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AIStudyBuddyCard({ weakSubject }: { weakSubject?: string }) {
  const [tipIndex, setTipIndex] = useState(() => {
    if (typeof window === "undefined") return 0;
    return new Date().getDate() % TIPS.length;
  });

  const rotateTip = () => {
    setTipIndex((prev) => (prev + 1) % TIPS.length);
  };

  const getRevisionTopics = (subject?: string): Array<{ topic: string; icon: string }> => {
    const sub = subject?.toLowerCase() || "";
    if (sub.includes("science")) {
      return [
        { topic: "Photosynthesis & Plant Respiration", icon: "🌱" },
        { topic: "Cell Structure & Functions", icon: "🔬" },
        { topic: "Chemical Reactions & Equations", icon: "🧪" },
      ];
    } else if (sub.includes("math")) {
      return [
        { topic: "Quadratic Equations", icon: "🔢" },
        { topic: "Trigonometric Identities", icon: "📐" },
        { topic: "Probability & Statistics", icon: "📊" },
      ];
    } else if (sub.includes("history") || sub.includes("social")) {
      return [
        { topic: "The French Revolution", icon: "🏛️" },
        { topic: "Nationalism in India", icon: "🌍" },
        { topic: "Federalism & Democracy", icon: "⚖️" },
      ];
    }
    return [
      { topic: "Force & Laws of Motion", icon: "🚀" },
      { topic: "Acid, Bases & Salts", icon: "🧪" },
      { topic: "Real Numbers & Polynomials", icon: "🔢" },
    ];
  };

  const revisionTopics = getRevisionTopics(weakSubject);

  return (
    <div
      className="card"
      style={{
        padding: 22,
        marginBottom: 16,
        background: "linear-gradient(135deg, rgba(99, 102, 241, 0.05) 0%, rgba(14, 165, 233, 0.05) 100%)",
        border: "1.5px solid rgba(99, 102, 241, 0.15)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
          <Sparkles size={16} style={{ color: "#6366f1" }} /> AI Study Buddy
        </h2>
        <button
          className="btn btn-ghost btn-sm"
          onClick={rotateTip}
          style={{ fontSize: 11, padding: "2px 8px", color: "#6366f1" }}
        >
          💡 Next Tip
        </button>
      </div>

      <div
        style={{
          background: "var(--bg-surface)",
          padding: "12px 14px",
          borderRadius: "var(--radius-md)",
          border: "1px solid var(--border-subtle)",
          marginBottom: 16,
        }}
      >
        <p style={{ fontSize: 13, color: "var(--text-primary)", fontStyle: "italic", margin: 0, lineHeight: 1.5 }}>
          &ldquo;{TIPS[tipIndex]}&rdquo;
        </p>
      </div>

      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
          🎯 Recommended Revision for {weakSubject || "General Science"}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {revisionTopics.map((item, idx) => (
            <Link
              key={idx}
              href={`/chat?topic=${encodeURIComponent(item.topic)}`}
              className="btn btn-secondary btn-sm"
              style={{
                justifyContent: "flex-start",
                padding: "8px 12px",
                fontSize: 12,
                background: "var(--bg-surface)",
                border: "1.5px solid var(--border)",
                textAlign: "left",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                display: "block",
              }}
            >
              <span style={{ marginRight: 6 }}>{item.icon}</span>
              {item.topic}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function XPProgressRing({ xp, xpNext }: { xp: number; xpNext: number }) {
  const level = Math.floor(xp / xpNext) + 1;
  const progressPct = Math.min((xp / xpNext) * 100, 100);
  const radius = 30;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progressPct / 100) * circumference;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <div style={{ position: "relative", width: 72, height: 72, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg style={{ transform: "rotate(-90deg)", width: 72, height: 72 }}>
          <circle
            cx="36"
            cy="36"
            r={radius}
            fill="transparent"
            stroke="rgba(255, 255, 255, 0.15)"
            strokeWidth="5"
          />
          <motion.circle
            cx="36"
            cy="36"
            r={radius}
            fill="transparent"
            stroke="#6ee7b7"
            strokeWidth="5"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset }}
            transition={{ duration: 1.2, ease: "easeOut" }}
            strokeLinecap="round"
            style={{
              filter: "drop-shadow(0 0 3px #6ee7b7)",
            }}
          />
        </svg>
        <div style={{ position: "absolute", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: "8px", fontWeight: 700, color: "rgba(255, 255, 255, 0.75)", textTransform: "uppercase", lineHeight: 1 }}>Lvl</span>
          <span style={{ fontSize: "18px", fontWeight: 800, color: "white", lineHeight: 1 }}>{level}</span>
        </div>
      </div>
      <div style={{ textAlign: "left" }}>
        <div style={{ fontSize: "14px", fontWeight: 700, color: "white" }}>{xp} XP</div>
        <div style={{ fontSize: "11px", color: "rgba(255, 255, 255, 0.75)" }}>{xpNext - xp} XP to Lvl {level + 1}</div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const { user, sessionId, isReady } = useUser();
  const dashboardRef = useRef<HTMLDivElement>(null);

  // Redirect non-students to their role-specific home page
  useEffect(() => {
    if (!isReady) return;
    if (!user) { router.replace("/login"); return; }
    if (user.role === "teacher") { router.replace("/teacher"); return; }
    if (user.role === "parent")  { router.replace("/parent");  return; }
    if (user.role === "admin")   { router.replace("/admin");   return; }
  }, [isReady, user, router]);
  const [progress, setProgress] = useState<{ history: HistoryItem[]; streak: number } | null>(null);
  const [dashboard, setDashboard] = useState<DashboardMetrics | null>(null);
  const [report, setReport] = useState<StudentReport | null>(null);
  const [artifacts, setArtifacts] = useState<SavedArtifact[]>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("sakhi_library_backup");
      if (stored) {
        try {
          return JSON.parse(stored);
        } catch {
          return [];
        }
      }
    }
    return [];
  });
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [retryTopic, setRetryTopic] = useState<RetryTopic | null>(null);
  const [dueFlashcards, setDueFlashcards] = useState(0);
  const [pendingAssignments, setPendingAssignments] = useState<Array<{ id: number; title: string; topic: string; subject: string; due_date: string | null; difficulty: string }>>([]);
  const [loading, setLoading] = useState(Boolean(user?.user_id));
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!user?.user_id || user.role !== "student") return;
    const load = async () => {
      try {
        const [progressData, dashboardData, reportData] = await Promise.all([
          api.getProgress(user.user_id) as Promise<{ history: HistoryItem[]; streak: number }>,
          api.getDashboard(user.organization_id) as Promise<DashboardMetrics>,
          api.getUserReport(user.user_id) as Promise<StudentReport>,
        ]);
        setProgress(progressData);
        setDashboard(dashboardData);
        setReport(reportData);
        const artifactData = await api.listArtifacts(user.user_id) as { artifacts?: SavedArtifact[] };
        const fetchedArtifacts = artifactData.artifacts || [];
        setArtifacts(fetchedArtifacts);
        if (typeof window !== "undefined") {
          localStorage.setItem("sakhi_library_backup", JSON.stringify(fetchedArtifacts));
        }
        // Phase 8: load recommendations + due flashcards in parallel
        const [recData, dueData] = await Promise.all([
          (api.getRecommendations(user.user_id) as Promise<{ next_topics?: Recommendation[]; retry_topic?: RetryTopic | null }>).catch(() => null),
          (api.getDueFlashcards(user.user_id) as Promise<{ stats?: { due_now: number } }>).catch(() => null),
        ]);
        if (recData) {
          setRecommendations(recData.next_topics || []);
          setRetryTopic(recData.retry_topic || null);
        }
        if (dueData?.stats) {
          setDueFlashcards(dueData.stats.due_now || 0);
        }
        // Phase 10: load pending student assignments
        const asgData = await (api.getStudentAssignments(user.user_id, user.organization_id) as unknown as Promise<Array<{ id: number; title: string; topic: string; subject: string; due_date: string | null; difficulty: string; my_submission?: { completed: boolean } }>>).catch(() => null);
        if (asgData) {
          const pending = (Array.isArray(asgData) ? asgData : []).filter(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (a: any) => !a.my_submission?.completed
          );
          setPendingAssignments(pending);
        }
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [sessionId, user?.organization_id, user?.user_id]);

  const streak = progress?.streak || 0;
  const history = progress?.history || [];
  const avgScore = history.length
    ? Math.round(history.reduce((a, h) => a + (h.score / h.total) * 100, 0) / history.length)
    : 0;
  const xp = history.length * 50 + streak * 20;
  const xpNext = 500;
  const badges = getBadges(streak, history.length, history);
  const weakTopics = report?.weak_topics || [];

  const downloadPDF = async () => {
    if (!dashboardRef.current) return;
    setExporting(true);
    try {
      const canvas = await html2canvas(dashboardRef.current, { scale: 1.5, useCORS: true, backgroundColor: "#f5f5f5" });
      const link = document.createElement("a");
      link.href = canvas.toDataURL("image/png");
      link.download = `sakhi-report-${user?.name || "student"}.png`;
      link.click();
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="app-shell">
        <Sidebar />
        <main className="main-content" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ width: 32, height: 32, border: "3px solid #e5e7eb", borderTopColor: "var(--emerald)", borderRadius: "50%", animation: "spin 0.7s linear infinite", margin: "0 auto 12px" }} />
            <p style={{ fontSize: 14, color: "var(--text-muted)" }}>Loading your progress...</p>
          </div>
        </main>
      </div>
    );
  }

  if (!isReady) {
    return (
      <div className="app-shell">
        <Sidebar />
        <main className="main-content" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ width: 32, height: 32, border: "3px solid #e5e7eb", borderTopColor: "var(--emerald)", borderRadius: "50%", animation: "spin 0.7s linear infinite", margin: "0 auto 12px" }} />
            <p style={{ fontSize: 14, color: "var(--text-muted)" }}>Loading...</p>
          </div>
        </main>
      </div>
    );
  }

  if (!user || user.role !== "student") {
    return null;
  }

  const isAdminView = (user?.role as string) === "admin";
  const isSupportView = (user?.role as string) === "parent" || (user?.role as string) === "teacher";

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main-content" style={{ overflowY: "auto" }}>
        <div ref={dashboardRef} style={{ maxWidth: 920, margin: "0 auto", padding: "32px 24px" }}>
          <div style={{ marginBottom: 28, display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.3px", marginBottom: 4 }}>Dashboard</h1>
              <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
                {user?.name ? `Hey ${user.name}! ` : ""}Here&apos;s your learning progress.
              </p>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={downloadPDF} disabled={exporting}>
              <Download size={13} /> {exporting ? "Exporting..." : "Export PNG"}
            </button>
          </div>

          {/* Sakhi Nudge Banner — Phase 8 */}
          <SakhiNudgeBanner
            streak={streak}
            weakTopics={weakTopics}
            dueFlashcards={dueFlashcards}
            userName={user?.name}
          />

          {/* Pending Assignments Banner — Phase 10 */}
          {pendingAssignments.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
              style={{
                marginBottom: 16, padding: "14px 20px",
                background: "#eff6ff", border: "1.5px solid #bfdbfe",
                borderRadius: "var(--radius-xl)",
                display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 22 }}>📋</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#1e40af" }}>
                    {pendingAssignments.length} pending assignment{pendingAssignments.length !== 1 ? "s" : ""} from your teacher
                  </div>
                  <div style={{ fontSize: 12, color: "#3b82f6" }}>
                    {pendingAssignments[0].title}
                    {pendingAssignments.length > 1 ? ` +${pendingAssignments.length - 1} more` : ""}
                  </div>
                </div>
              </div>
              <Link
                href={`/quiz?topic=${encodeURIComponent(pendingAssignments[0].topic)}&difficulty=${pendingAssignments[0].difficulty}`}
                className="btn btn-sm"
                style={{ background: "#2563eb", color: "white", flexShrink: 0 }}
              >
                Start Now →
              </Link>
            </motion.div>
          )}

          {/* Profile banner */}
          <div style={{
            background: "linear-gradient(135deg, #065f46 0%, #0d9488 100%)",
            borderRadius: "var(--radius-xl)",
            padding: "22px 24px",
            color: "white",
            marginBottom: 20,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            position: "relative",
            overflow: "hidden",
          }}>
            <div style={{ position: "absolute", top: -20, right: -20, width: 120, height: 120, borderRadius: "50%", background: "rgba(255,255,255,0.05)" }} />
            <div>
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", marginBottom: 4, letterSpacing: "0.04em", textTransform: "uppercase", fontWeight: 600 }}>
                {user?.role} · {user?.organization_name || "Demo School"} · Class {user?.class_}
              </p>
              <p style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.5px" }}>{user?.name || "Student"}</p>
            </div>
            <XPProgressRing xp={xp} xpNext={xpNext} />
          </div>

          {/* Stat cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
            {/* Streak card with animated flame */}
            <div className="card" style={{ padding: 20 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: "#fff7ed", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14, fontSize: 18 }}>
                <span className={streak > 0 ? "streak-flame" : ""}>🔥</span>
              </div>
              <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.5px", color: "var(--text-primary)", marginBottom: 2 }}>{streak}</div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 500 }}>Day Streak</div>
            </div>
            <StatCard icon={Star} label="Avg Score" value={`${avgScore}%`} iconBg="#fefce8" iconColor="#ca8a04" />
            <StatCard icon={Trophy} label="Quizzes Done" value={history.length} iconBg="#f5f3ff" iconColor="#7c3aed" />
            <StatCard icon={Target} label="XP Earned" value={xp} iconBg="#f0fdf4" iconColor="var(--emerald)" />
          </div>

          {/* Daily goal */}
          <DailyGoalCard key={user?.user_id ?? "guest"} userId={user?.user_id} weakSubject={user?.weak_subject} />

          {/* What to Study Next — Phase 8 */}
          {(recommendations.length > 0 || retryTopic) && (
            <WhatToStudyNext recommendations={recommendations} retryTopic={retryTopic} />
          )}

          {/* AI Study Buddy Card */}
          <AIStudyBuddyCard weakSubject={user?.weak_subject} />

          {/* Weekly Streak Calendar */}
          <WeeklyStreakCalendar history={history} />


          <div className="card" style={{ padding: 22, marginBottom: 16 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
              <BookOpen size={16} style={{ color: "var(--emerald)" }} /> Study Library
            </h2>
            {artifacts.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Save helpful chat answers, study plans, and quiz results to build your personal revision library.</p>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {artifacts.slice(0, 6).map((artifact) => (
                  <div key={artifact.id} style={{ padding: "12px 14px", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)", background: "#fafafa" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 4 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{artifact.title}</div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{new Date(artifact.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</div>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                      {artifact.artifact_type.replaceAll("_", " ")}{artifact.topic ? ` · ${artifact.topic}` : ""}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Activity heatmap */}
          {history.length > 0 ? (
            <ActivityHeatmap history={history} />
          ) : (
            <div className="card" style={{ padding: 22, marginBottom: 16, textAlign: "center" }}>
              <Calendar size={28} style={{ color: "#d1d5db", margin: "0 auto 10px" }} />
              <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 14 }}>Complete quizzes to light up your activity heatmap!</p>
              <Link href="/quiz" className="btn btn-primary btn-sm" style={{ display: "inline-flex" }}>
                <Zap size={13} /> Take Your First Quiz
              </Link>
            </div>
          )}

          {/* Weak topic insight card — shows after 3+ quizzes */}
          {history.length >= 3 && weakTopics.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="card"
              style={{ padding: 22, marginBottom: 16, border: "1px solid #fde68a", background: "#fffbeb" }}
            >
              <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
                <Lightbulb size={16} style={{ color: "#ca8a04" }} /> Sakhi&apos;s Insight
              </h2>
              <p style={{ fontSize: 13, color: "#78350f", marginBottom: 14, lineHeight: 1.6 }}>
                You&apos;ve scored below 60% in <strong>{weakTopics.slice(0, 2).join(" and ")}</strong>.
                Want Sakhi to create a focused revision plan for these topics?
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                {weakTopics.slice(0, 2).map((t) => (
                  <Link key={t} href={`/study-plan?topic=${encodeURIComponent(t)}`} className="btn btn-primary btn-sm">
                    📚 Revise: {t}
                  </Link>
                ))}
                <Link href="/quiz" className="btn btn-secondary btn-sm">
                  <Zap size={13} /> Retry Quiz
                </Link>
              </div>
            </motion.div>
          )}

          {/* Support view */}
          {(isSupportView || isAdminView) && (
            <div className="card" style={{ padding: 22, marginBottom: 16 }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
                <Users size={16} style={{ color: "var(--emerald)" }} /> Parent / Teacher Insights
              </h2>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                <StatCard icon={BookOpen} label="Weak Topics" value={report?.weak_topics?.length || 0} iconBg="#eff6ff" iconColor="#2563eb" />
                <StatCard icon={TrendingUp} label="Org Users" value={dashboard?.total_users || 0} iconBg="#f0fdf4" iconColor="#059669" />
                <StatCard icon={ShieldCheck} label="Events Logged" value={dashboard?.total_events || 0} iconBg="#fef2f2" iconColor="#dc2626" />
              </div>
              <div style={{ marginTop: 16, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.7 }}>
                <strong>Weak topics:</strong> {(report?.weak_topics || []).join(", ") || "No quiz data yet"}.
              </div>
            </div>
          )}

          {/* Admin view */}
          {isAdminView && (
            <div className="card" style={{ padding: 22, marginBottom: 16 }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
                <ShieldCheck size={16} style={{ color: "#ca8a04" }} /> Admin Analytics
              </h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 16 }}>
                <StatCard icon={Users} label="Users" value={dashboard?.total_users || 0} iconBg="#eff6ff" iconColor="#2563eb" />
                <StatCard icon={MessageCircle} label="Chat Sessions" value={dashboard?.total_chat_sessions || 0} iconBg="#fdf4ff" iconColor="#9333ea" />
                <StatCard icon={Zap} label="Quiz Attempts" value={dashboard?.total_quiz_attempts || 0} iconBg="#fefce8" iconColor="#ca8a04" />
                <StatCard icon={TrendingUp} label="Active 7d" value={dashboard?.active_users_7d || 0} iconBg="#f0fdf4" iconColor="#059669" />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div style={{ padding: 14, background: "#fafafa", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)" }}>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>Role Distribution</div>
                  <div style={{ fontSize: 13, color: "var(--text-primary)", lineHeight: 1.8 }}>
                    {Object.entries(dashboard?.roles || {}).map(([role, count]) => (
                      <div key={role}>{role}: {String(count)}</div>
                    ))}
                  </div>
                </div>
                <div style={{ padding: 14, background: "#fafafa", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)" }}>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>Top Languages</div>
                  <div style={{ fontSize: 13, color: "var(--text-primary)", lineHeight: 1.8 }}>
                    {(dashboard?.languages || []).slice(0, 5).map((item) => (
                      <div key={item.language}>{item.language}: {item.count}</div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Badges */}
          <div className="card" style={{ padding: 22, marginBottom: 16 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
              <Trophy size={16} style={{ color: "#ca8a04" }} /> Achievements
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 10 }}>
              {badges.map((b) => (
                <motion.div
                  key={b.name}
                  whileHover={{ scale: 1.06 }}
                  title={b.desc}
                  style={{
                    textAlign: "center",
                    padding: "12px 8px",
                    borderRadius: "var(--radius-md)",
                    background: b.earned ? "#f0fdf4" : "#f9fafb",
                    border: `1px solid ${b.earned ? "#bbf7d0" : "#f3f4f6"}`,
                    opacity: b.earned ? 1 : 0.45,
                    cursor: "default",
                    transition: "all 0.2s",
                  }}
                >
                  <div style={{ fontSize: 22, marginBottom: 6 }}>{b.icon}</div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", lineHeight: 1.3 }}>{b.name}</div>
                  {b.earned && <div style={{ fontSize: 9, color: "var(--emerald)", marginTop: 3, fontWeight: 600 }}>EARNED</div>}
                </motion.div>
              ))}
            </div>
          </div>

          {/* Recent activity */}
          <div className="card" style={{ padding: 22 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
              <TrendingUp size={16} style={{ color: "var(--emerald)" }} /> Recent Activity
            </h2>
            {history.length === 0 ? (
              <div style={{ textAlign: "center", padding: "32px 0" }}>
                <BookOpen size={28} style={{ color: "#d1d5db", margin: "0 auto 10px" }} />
                <p style={{ fontSize: 13, color: "var(--text-muted)" }}>No quizzes yet. Take your first quiz!</p>
                <Link href="/quiz" className="btn btn-primary btn-sm" style={{ marginTop: 14, display: "inline-flex" }}>
                  <Zap size={13} /> Start a Quiz
                </Link>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {history.slice(0, 8).map((h, i) => {
                  const pct = Math.round((h.score / h.total) * 100);
                  return (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: "var(--radius-md)", background: "#fafafa", border: "1px solid var(--border-subtle)" }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: pct >= 80 ? "#f0fdf4" : pct >= 60 ? "#fefce8" : "#fef2f2", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, flexShrink: 0 }}>
                        {pct >= 80 ? "⭐" : pct >= 60 ? "📝" : "💪"}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.topic}</p>
                        <div className="progress-track" style={{ height: 5 }}>
                          <div className="progress-fill" style={{ width: `${pct}%`, height: "100%" }} />
                        </div>
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>{h.score}/{h.total}</p>
                        <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{new Date(h.timestamp).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
