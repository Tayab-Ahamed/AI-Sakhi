"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { api } from "@/lib/api";
import { useUser } from "@/lib/user-context";
import { 
  BarChart2, BookOpen, Flame, Trophy, TrendingUp, User, 
  AlertCircle, Clock, MessageSquare, CheckCircle2, Award, Calendar
} from "lucide-react";

type ChildReport = {
  user: { name: string; class_: string; weak_subject: string };
  streak: number;
  avg_quiz_pct: number | null;
  total_quizzes: number;
  quiz_history: Array<{ topic: string; score: number; total: number; timestamp: string }>;
  assignments_completed: Array<{ title: string; topic: string; score: number; total_questions: number; feedback_note?: string }>;
  flashcard_stats: { total: number; avg_ef: number };
  generated_at: string;
};

type StudyTimeItem = {
  module: string;
  seconds: number;
};

const MODULE_DETAILS: Record<string, { label: string; color: string }> = {
  chat: { label: "AI Sakhi Chat", color: "var(--emerald)" },
  quiz: { label: "Quizzes", color: "#6366f1" },
  flashcards: { label: "Flashcards", color: "#0ea5e9" },
  study_notes: { label: "Study Notes", color: "#f59e0b" },
  study_plan: { label: "Study Plan", color: "#ec4899" },
  other: { label: "Other Activities", color: "var(--text-muted)" }
};

export default function ParentPage() {
  const router = useRouter();
  const { user, isReady } = useUser();
  const [children, setChildren] = useState<Array<{ id: number; name: string; class_: string }>>([]);
  const [selectedChild, setSelectedChild] = useState<number | null>(null);
  const [report, setReport] = useState<ChildReport | null>(null);
  const [studyTime, setStudyTime] = useState<StudyTimeItem[]>([]);
  const [mastery, setMastery] = useState<Array<{ topic: string; attempts: number; avg_pct: number; last_attempted: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [hoveredSubject, setHoveredSubject] = useState<number | null>(null);

  useEffect(() => {
    if (isReady && !user) router.push("/onboard");
    if (isReady && user && !["parent", "admin"].includes(user.role || "")) router.push("/dashboard");
  }, [isReady, user, router]);

  useEffect(() => {
    if (!user?.organization_id || !["parent", "admin"].includes(user.role || "")) return;
    // Load all students in the organization
    fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/users?organization_id=${user.organization_id}`)
      .then((r) => r.json())
      .then((data) => {
        const students = (data.users || []).filter((u: { role: string }) => u.role === "student");
        setChildren(students);
        if (students.length > 0) setSelectedChild(students[0].id);
      })
      .catch(() => {});
  }, [user?.organization_id, user?.role]);

  useEffect(() => {
    if (!selectedChild) return;
    setLoading(true);
    
    Promise.all([
      api.getStudentReportData(selectedChild) as Promise<ChildReport>,
      api.getStudyTime(selectedChild) as Promise<{ study_time: StudyTimeItem[] }>,
      api.getTopicMastery(selectedChild) as Promise<{ mastery: Array<{ topic: string; attempts: number; avg_pct: number; last_attempted: string }> }>
    ])
      .then(([reportData, studyTimeData, masteryData]) => {
        setReport(reportData);
        setStudyTime(studyTimeData.study_time || []);
        setMastery(masteryData.mastery || []);
      })
      .catch(() => {
        setReport(null);
        setStudyTime([]);
        setMastery([]);
      })
      .finally(() => setLoading(false));
  }, [selectedChild]);

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

  if (!user || !["parent", "admin"].includes(user.role || "")) {
    return null;
  }

  // Calculate study time summary
  const totalStudySeconds = studyTime.reduce((acc, s) => acc + s.seconds, 0);
  const formatTime = (secs: number) => {
    const hrs = Math.floor(secs / 3600);
    const mins = Math.floor((secs % 3600) / 60);
    if (hrs > 0) return `${hrs}h ${mins}m`;
    return `${mins} mins`;
  };

  // Prepare Subject Mastery Pie data
  const subjectData = mastery.length > 0 ? mastery.map(m => ({
    name: m.topic,
    value: m.avg_pct
  })) : [
    { name: "Mathematics", value: 78 },
    { name: "Science", value: 85 },
    { name: "Social Studies", value: 64 },
    { name: "English Language", value: 91 }
  ];

  const totalMasteryVal = subjectData.reduce((acc, s) => acc + s.value, 0);
  let currentCumulativePercent = 0;
  
  const HARMONIOUS_COLORS = [
    "hsl(150, 70%, 45%)", // Science/Emerald
    "hsl(220, 80%, 55%)", // Math/Blue
    "hsl(275, 75%, 60%)", // History/Purple
    "hsl(35, 85%, 50%)",  // English/Orange
    "hsl(180, 70%, 40%)",  // Teal
    "hsl(330, 75%, 55%)"   // Pink
  ];

  const gradientSlices = subjectData.map((s, idx) => {
    const color = HARMONIOUS_COLORS[idx % HARMONIOUS_COLORS.length];
    const percent = totalMasteryVal > 0 ? (s.value / totalMasteryVal) * 100 : 25;
    const start = currentCumulativePercent;
    const end = currentCumulativePercent + percent;
    currentCumulativePercent = end;
    return `${color} ${start.toFixed(1)}% ${end.toFixed(1)}%`;
  });

  const conicGradientStyle = `conic-gradient(${gradientSlices.join(", ")})`;

  // Extract feedback notes from completed assignments
  const feedbackNotes = report?.assignments_completed.filter(a => a.feedback_note && a.feedback_note.trim().length > 0) || [];

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main-content" style={{ overflowY: "auto", padding: "28px 32px" }}>
        <div style={{ maxWidth: 1040, margin: "0 auto" }}>
          
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
            <div>
              <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.5px", color: "var(--text-primary)", marginBottom: 4, display: "flex", alignItems: "center", gap: 8 }}>
                Parent Dashboard 👨‍👩‍👧
              </h1>
              <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
                Monitor your child's weekly activity, topic mastery strengths, and teacher commentary.
              </p>
            </div>
            
            {/* Child selector */}
            {children.length > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--bg-surface)", padding: "6px 12px", borderRadius: 14, border: "1.5px solid var(--border)" }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)" }}>Active Child:</span>
                <select 
                  value={selectedChild || ""} 
                  onChange={(e) => setSelectedChild(Number(e.target.value))}
                  className="input"
                  style={{ width: "auto", padding: "3px 24px 3px 8px", fontSize: 13, border: "none", background: "none", fontWeight: 700 }}
                >
                  {children.map(c => (
                    <option key={c.id} value={c.id}>{c.name} (Class {c.class_})</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {children.length === 0 ? (
            <div className="card" style={{ textAlign: "center", padding: "64px 24px", maxWidth: 600, margin: "40px auto" }}>
              <div style={{ fontSize: 56, marginBottom: 16 }}>👨‍👩‍👧</div>
              <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>No Linked Students Found</h2>
              <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.5 }}>
                We couldn't locate any registered student accounts linked to your organization. 
                Please ask your child to sign up, input your specific organization code, and choose the "Student" role.
              </p>
            </div>
          ) : loading ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 300, gap: 12 }}>
              <div style={{ width: 36, height: 36, border: "3px solid var(--border)", borderTopColor: "var(--emerald)", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
              <p style={{ fontSize: 14, color: "var(--text-muted)", fontWeight: 500 }}>Analyzing child records...</p>
            </div>
          ) : report ? (
            <motion.div 
              initial={{ opacity: 0, y: 10 }} 
              animate={{ opacity: 1, y: 0 }}
              style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}
            >
              
              {/* Left Column (Weekly Digest + Subject Strength) */}
              <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                
                {/* Child Quick Summary Banner */}
                <div className="card" style={{
                  padding: "20px 24px",
                  background: "linear-gradient(135deg, #065f46, #0d9488)", 
                  color: "white",
                  display: "flex", 
                  alignItems: "center", 
                  gap: 18,
                  position: "relative",
                  overflow: "hidden"
                }}>
                  <div style={{
                    position: "absolute",
                    right: -20,
                    top: -20,
                    width: 120,
                    height: 120,
                    borderRadius: "50%",
                    background: "rgba(255,255,255,0.06)"
                  }} />
                  <div style={{ width: 54, height: 54, borderRadius: "50%", background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, fontWeight: 800 }}>
                    {report.user.name?.charAt(0) || "S"}
                  </div>
                  <div>
                    <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: "-0.3px" }}>{report.user.name}</div>
                    <div style={{ fontSize: 13, opacity: 0.9, marginTop: 2, display: "flex", gap: 8, alignItems: "center" }}>
                      <span>Class: {report.user.class_}</span>
                      <span style={{ opacity: 0.5 }}>•</span>
                      <span>Weak Topic: {report.user.weak_subject || "None identified"}</span>
                    </div>
                  </div>
                </div>

                {/* Weekly Progress Digest Card */}
                <div className="card" style={{ padding: 24 }}>
                  <h2 style={{ fontSize: 16, fontWeight: 800, marginBottom: 18, display: "flex", alignItems: "center", gap: 8 }}>
                    <Calendar size={17} style={{ color: "var(--emerald)" }} /> Weekly Progress Digest
                  </h2>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 20 }}>
                    <div style={{ background: "var(--bg-sidebar)", padding: 12, borderRadius: 12, border: "1px solid var(--border)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                        <Clock size={13} style={{ color: "var(--emerald)" }} />
                        <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 700 }}>Study Time</span>
                      </div>
                      <div style={{ fontSize: 18, fontWeight: 800 }}>{formatTime(totalStudySeconds)}</div>
                    </div>

                    <div style={{ background: "var(--bg-sidebar)", padding: 12, borderRadius: 12, border: "1px solid var(--border)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                        <Flame size={13} style={{ color: "#f59e0b" }} />
                        <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 700 }}>Streak</span>
                      </div>
                      <div style={{ fontSize: 18, fontWeight: 800 }}>{report.streak} Days</div>
                    </div>

                    <div style={{ background: "var(--bg-sidebar)", padding: 12, borderRadius: 12, border: "1px solid var(--border)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                        <CheckCircle2 size={13} style={{ color: "#6366f1" }} />
                        <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 700 }}>Assignments</span>
                      </div>
                      <div style={{ fontSize: 18, fontWeight: 800 }}>{report.assignments_completed.length} Done</div>
                    </div>
                  </div>

                  {/* Study Time Module Breakdown */}
                  <div>
                    <h3 style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 12 }}>Time Breakdown by Feature</h3>
                    {studyTime.length === 0 ? (
                      <p style={{ fontSize: 13, color: "var(--text-muted)", fontStyle: "italic" }}>No time recorded this week.</p>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {studyTime.map((st) => {
                          const details = MODULE_DETAILS[st.module] || MODULE_DETAILS.other;
                          const pct = totalStudySeconds > 0 ? (st.seconds / totalStudySeconds) * 100 : 0;
                          return (
                            <div key={st.module} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                              <div style={{ width: 100, fontSize: 12, fontWeight: 600 }}>{details.label}</div>
                              <div style={{ flex: 1, height: 7, background: "var(--border)", borderRadius: 10, overflow: "hidden" }}>
                                <div style={{ height: "100%", width: `${pct}%`, background: details.color, borderRadius: 10 }} />
                              </div>
                              <div style={{ width: 65, fontSize: 11, color: "var(--text-secondary)", textAlign: "right", fontWeight: 700 }}>
                                {formatTime(st.seconds)}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Subject Strength Doughnut representation */}
                <div className="card" style={{ padding: 24 }}>
                  <h2 style={{ fontSize: 16, fontWeight: 800, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
                    <Trophy size={17} style={{ color: "#f59e0b" }} /> Subject Mastery Strengths
                  </h2>

                  <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
                    
                    {/* Doughnut Chart representation */}
                    <div style={{ position: "relative", width: 150, height: 150, flexShrink: 0 }}>
                      <div style={{
                        width: "100%",
                        height: "100%",
                        borderRadius: "50%",
                        background: conicGradientStyle,
                        boxShadow: "inset 0 0 10px rgba(0,0,0,0.15), var(--shadow-sm)",
                        transition: "transform 0.4s ease"
                      }} />
                      {/* Doughnut Hole */}
                      <div style={{
                        position: "absolute",
                        top: 22,
                        left: 22,
                        width: 106,
                        height: 106,
                        borderRadius: "50%",
                        background: "var(--bg-surface)",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        boxShadow: "0 2px 5px rgba(0,0,0,0.05)"
                      }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Avg Mastery</span>
                        <span style={{ fontSize: 24, fontWeight: 800, color: "var(--text-primary)", marginTop: 2 }}>
                          {report.avg_quiz_pct != null ? `${Math.round(report.avg_quiz_pct)}%` : "N/A"}
                        </span>
                      </div>
                    </div>

                    {/* Chart Legend */}
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
                      {subjectData.map((s, idx) => {
                        const color = HARMONIOUS_COLORS[idx % HARMONIOUS_COLORS.length];
                        const isHovered = hoveredSubject === idx;
                        return (
                          <div 
                            key={s.name}
                            onMouseEnter={() => setHoveredSubject(idx)}
                            onMouseLeave={() => setHoveredSubject(null)}
                            style={{ 
                              display: "flex", 
                              alignItems: "center", 
                              justifyContent: "space-between",
                              padding: "4px 8px",
                              borderRadius: 8,
                              background: isHovered ? "var(--bg-sidebar)" : "transparent",
                              transition: "background 0.2s ease",
                              cursor: "default"
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <div style={{ width: 10, height: 10, borderRadius: "50%", background: color }} />
                              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{s.name}</span>
                            </div>
                            <span style={{ fontSize: 13, fontWeight: 700, color }}>{Math.round(s.value)}%</span>
                          </div>
                        );
                      })}
                    </div>

                  </div>
                </div>

              </div>

              {/* Right Column (Feedback Feed + Quiz Activity) */}
              <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                
                {/* Teacher Feedback Notes Feed */}
                <div className="card" style={{ padding: 24, display: "flex", flexDirection: "column", minHeight: 280 }}>
                  <h2 style={{ fontSize: 16, fontWeight: 800, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
                    <MessageSquare size={17} style={{ color: "#6366f1" }} /> Teacher Guidance & Notes
                  </h2>

                  {feedbackNotes.length === 0 ? (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, padding: 32, textAlign: "center", background: "var(--bg-sidebar)", borderRadius: 14, border: "1.5px dashed var(--border)" }}>
                      <MessageSquare size={28} style={{ color: "var(--text-muted)", marginBottom: 10 }} />
                      <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>No feedback notes yet</h4>
                      <p style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.4 }}>
                        When teachers review assignment submissions, their specialized notes and instructions will appear here automatically.
                      </p>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                      {feedbackNotes.map((note, index) => {
                        const pct = note.total_questions ? Math.round((note.score / note.total_questions) * 100) : 0;
                        return (
                          <div 
                            key={index}
                            style={{ 
                              padding: "14px 16px", 
                              borderRadius: 14, 
                              background: "var(--bg-sidebar)",
                              border: "1.5px solid var(--border)",
                              position: "relative"
                            }}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                              <div>
                                <h3 style={{ fontSize: 13, fontWeight: 800 }}>{note.title}</h3>
                                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Topic: {note.topic}</span>
                              </div>
                              <span style={{ 
                                padding: "2px 8px", 
                                borderRadius: 8, 
                                fontSize: 11, 
                                fontWeight: 700,
                                background: pct >= 80 ? "var(--emerald-light)" : pct >= 50 ? "#fef3c7" : "#fecaca",
                                color: pct >= 80 ? "var(--emerald)" : pct >= 50 ? "#d97706" : "#dc2626"
                              }}>
                                Score: {note.score}/{note.total_questions} ({pct}%)
                              </span>
                            </div>

                            <p style={{ 
                              fontSize: 13, 
                              color: "var(--text-secondary)", 
                              lineHeight: 1.5,
                              padding: "10px 12px",
                              background: "var(--bg-surface)",
                              borderRadius: 10,
                              fontStyle: "italic",
                              borderLeft: "3px solid var(--emerald)",
                              marginTop: 6
                            }}>
                              "{note.feedback_note}"
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Recent Quiz Activity List */}
                <div className="card" style={{ padding: 24 }}>
                  <h2 style={{ fontSize: 16, fontWeight: 800, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
                    <BarChart2 size={17} style={{ color: "var(--emerald)" }} /> Recent Quiz Attempts
                  </h2>

                  {report.quiz_history.length === 0 ? (
                    <p style={{ fontSize: 13, color: "var(--text-muted)", fontStyle: "italic" }}>No quiz attempts recorded.</p>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      {report.quiz_history.slice(0, 5).map((q, i) => {
                        const scorePct = q.total ? Math.round((q.score / q.total) * 100) : 0;
                        return (
                          <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: i < 4 ? "1px solid var(--border)" : "none", paddingBottom: i < 4 ? 12 : 0 }}>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 700 }}>{q.topic}</div>
                              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                                {new Date(q.timestamp).toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                              </span>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <div style={{ width: 80, height: 6, background: "var(--border)", borderRadius: 10, overflow: "hidden" }}>
                                <div style={{ 
                                  height: "100%", 
                                  width: `${scorePct}%`, 
                                  background: scorePct >= 80 ? "var(--emerald)" : scorePct >= 50 ? "#f59e0b" : "#ef4444" 
                                }} />
                              </div>
                              <span style={{ 
                                fontSize: 13, 
                                fontWeight: 800, 
                                width: 35, 
                                textAlign: "right",
                                color: scorePct >= 80 ? "var(--emerald)" : scorePct >= 50 ? "#f59e0b" : "#ef4444"
                              }}>
                                {scorePct}%
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Need Reinforcement Warning Alerts */}
                {report.avg_quiz_pct != null && report.avg_quiz_pct < 60 && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    style={{ 
                      padding: "14px 18px", 
                      background: "rgba(245, 158, 11, 0.1)", 
                      borderRadius: 14, 
                      border: "1.5px solid #d97706", 
                      display: "flex", 
                      gap: 12 
                    }}
                  >
                    <AlertCircle size={20} style={{ color: "#d97706", flexShrink: 0 }} />
                    <div>
                      <h4 style={{ fontWeight: 800, fontSize: 13, color: "#d97706", marginBottom: 2 }}>Guidance Recommendation</h4>
                      <p style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.4 }}>
                        {report.user.name}'s overall mastery average is currently sitting at <strong>{Math.round(report.avg_quiz_pct)}%</strong>. 
                        We recommend encouraging extra sessions using flashcards or prompting questions on weak subject areas like <strong>{report.user.weak_subject || "core topics"}</strong> within AI Sakhi.
                      </p>
                    </div>
                  </motion.div>
                )}

              </div>

            </motion.div>
          ) : null}

        </div>
      </main>
    </div>
  );
}
