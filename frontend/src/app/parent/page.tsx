"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import { api } from "@/lib/api";
import { useUser } from "@/lib/user-context";
import { BarChart2, BookOpen, Flame, Trophy, TrendingUp, User, AlertCircle } from "lucide-react";

type ChildReport = {
  user: { name: string; class_: string; weak_subject: string };
  streak: number;
  avg_quiz_pct: number | null;
  total_quizzes: number;
  quiz_history: Array<{ topic: string; score: number; total: number; timestamp: string }>;
  assignments_completed: Array<{ title: string; topic: string; score: number; total_questions: number }>;
  flashcard_stats: { total: number; avg_ef: number };
  generated_at: string;
};

export default function ParentPage() {
  const router = useRouter();
  const { user, isReady } = useUser();
  const [children, setChildren] = useState<Array<{ id: number; name: string; class_: string }>>([]);
  const [selectedChild, setSelectedChild] = useState<number | null>(null);
  const [report, setReport] = useState<ChildReport | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isReady && !user) router.push("/onboard");
    if (isReady && user && !["parent", "admin"].includes(user.role || "")) router.push("/dashboard");
  }, [isReady, user, router]);

  useEffect(() => {
    if (!user?.organization_id) return;
    // Fetch all students in same org
    api.listAssignments({ organization_id: user.organization_id })
      .then(() => {
        // For now, load all users in the org (parent sees their children by org)
        return fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/users?organization_id=${user.organization_id}`)
          .then((r) => r.json())
          .then((data) => {
            const students = (data.users || []).filter((u: { role: string }) => u.role === "student");
            setChildren(students);
            if (students.length > 0) setSelectedChild(students[0].id);
          });
      })
      .catch(() => {});
  }, [user?.organization_id]);

  useEffect(() => {
    if (!selectedChild) return;
    setLoading(true);
    (api.getStudentReportData(selectedChild) as Promise<ChildReport>)
      .then((data) => setReport(data))
      .catch(() => setReport(null))
      .finally(() => setLoading(false));
  }, [selectedChild]);

  const recentHistory = report?.quiz_history?.slice(0, 6) || [];

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main-content" style={{ overflowY: "auto", padding: "28px 32px" }}>
        <div style={{ maxWidth: 820, margin: "0 auto" }}>
          <div style={{ marginBottom: 24 }}>
            <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.4px", color: "var(--text-primary)", marginBottom: 4 }}>
              Parent Dashboard 👨‍👩‍👧
            </h1>
            <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
              Monitor your child's learning progress and performance.
            </p>
          </div>

          {/* Child selector */}
          {children.length > 1 && (
            <div style={{ marginBottom: 20, display: "flex", gap: 8 }}>
              {children.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedChild(c.id)}
                  className={selectedChild === c.id ? "btn btn-primary btn-sm" : "btn btn-secondary btn-sm"}
                >
                  <User size={13} /> {c.name}
                </button>
              ))}
            </div>
          )}

          {children.length === 0 ? (
            <div className="card" style={{ textAlign: "center", padding: "56px 24px" }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>👨‍👩‍👧</div>
              <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 8 }}>No students found</h2>
              <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
                No student accounts are linked to your organisation yet.
                Ask your child to sign up and select the same school.
              </p>
            </div>
          ) : loading ? (
            <div style={{ textAlign: "center", padding: 60, color: "var(--text-muted)" }}>Loading report…</div>
          ) : report ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              {/* Child profile banner */}
              <div className="card" style={{
                padding: "20px 24px", marginBottom: 16,
                background: "linear-gradient(135deg, #065f46, #0d9488)", color: "white",
                display: "flex", alignItems: "center", gap: 16,
              }}>
                <div style={{ width: 52, height: 52, borderRadius: "50%", background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>
                  {report.user.name?.charAt(0) || "S"}
                </div>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800 }}>{report.user.name}</div>
                  <div style={{ fontSize: 13, opacity: 0.8 }}>Class {report.user.class_} · Weak in: {report.user.weak_subject || "–"}</div>
                </div>
              </div>

              {/* Stat cards */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 16 }}>
                {[
                  { label: "Streak",       value: `${report.streak}🔥`,                    icon: Flame,    color: "#f59e0b" },
                  { label: "Avg Score",    value: report.avg_quiz_pct != null ? `${report.avg_quiz_pct}%` : "–", icon: TrendingUp, color: "#059669" },
                  { label: "Quizzes Done", value: report.total_quizzes,                     icon: BookOpen, color: "#6366f1" },
                  { label: "Flashcards",   value: report.flashcard_stats?.total ?? 0,       icon: Trophy,   color: "#0ea5e9" },
                ].map(({ label, value, icon: Icon, color }) => (
                  <div key={label} className="card" style={{ padding: "14px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                      <Icon size={13} style={{ color }} />
                      <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>{label}</span>
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 800 }}>{value}</div>
                  </div>
                ))}
              </div>

              {/* Recent quiz history */}
              <div className="card" style={{ padding: "18px 20px", marginBottom: 16 }}>
                <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 14, display: "flex", alignItems: "center", gap: 6 }}>
                  <BarChart2 size={15} style={{ color: "var(--emerald)" }} /> Recent Quiz Activity
                </h2>
                {recentHistory.length === 0 ? (
                  <p style={{ fontSize: 13, color: "var(--text-muted)" }}>No quiz activity yet.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {recentHistory.map((h, i) => {
                      const pct = h.total ? Math.round((h.score / h.total) * 100) : 0;
                      return (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <div style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{h.topic}</div>
                          <div style={{ width: 120 }}>
                            <div className="progress-track" style={{ height: 6 }}>
                              <div className="progress-fill" style={{ width: `${pct}%`, background: pct >= 70 ? "var(--emerald)" : pct >= 40 ? "#f59e0b" : "#ef4444" }} />
                            </div>
                          </div>
                          <div style={{ width: 36, fontSize: 12, fontWeight: 700, textAlign: "right", color: pct >= 70 ? "var(--emerald)" : pct >= 40 ? "#f59e0b" : "#ef4444" }}>{pct}%</div>
                          <div style={{ fontSize: 11, color: "var(--text-muted)", width: 70, textAlign: "right" }}>
                            {new Date(h.timestamp).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Assignments */}
              {(report.assignments_completed?.length ?? 0) > 0 && (
                <div className="card" style={{ padding: "18px 20px" }}>
                  <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>✅ Completed Assignments</h2>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {report.assignments_completed.map((a, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                        <span style={{ fontWeight: 500 }}>{a.title}</span>
                        <span style={{ color: "var(--emerald)", fontWeight: 700 }}>
                          {a.score}/{a.total_questions} ({Math.round((a.score / a.total_questions) * 100)}%)
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Weak subject alert */}
              {report.avg_quiz_pct != null && report.avg_quiz_pct < 50 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  style={{ marginTop: 16, padding: "14px 18px", background: "#fef3c7", borderRadius: 14, border: "1.5px solid #fcd34d", display: "flex", gap: 10 }}>
                  <AlertCircle size={18} style={{ color: "#d97706", flexShrink: 0, marginTop: 1 }} />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: "#92400e" }}>Needs more practice</div>
                    <div style={{ fontSize: 12, color: "#b45309" }}>
                      Average score is below 50%. Encourage {report.user.name?.split(" ")[0]} to use Flashcards and Chat with Sakhi for help.
                    </div>
                  </div>
                </motion.div>
              )}
            </motion.div>
          ) : null}
        </div>
      </main>
    </div>
  );
}
