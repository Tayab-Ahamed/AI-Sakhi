"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { api } from "@/lib/api";
import { useUser } from "@/lib/user-context";
import { getSubjectsForClass, getTopicsForSubjectAndClass } from "@/lib/curriculum";
import {
  Plus, Trash2, Users, BookOpen, CheckCircle2, Clock,
  ClipboardList, Download, ChevronDown, ChevronUp, BarChart2, AlertCircle,
} from "lucide-react";

type Assignment = {
  id: number;
  title: string;
  subject: string;
  topic: string;
  difficulty: string;
  class_: string;
  instructions: string;
  due_date: string | null;
  is_overdue: boolean;
  submission_count: number;
  completed_count: number;
  created_at: string;
};

type Submission = {
  id: number;
  student_name: string;
  score: number;
  total_questions: number;
  completed: number;
  submitted_at: string;
};

const DIFFICULTIES = ["easy", "medium", "hard"];

const BADGE_COLORS: Record<string, { bg: string; color: string }> = {
  easy:   { bg: "#d1fae5", color: "#065f46" },
  medium: { bg: "#fef3c7", color: "#92400e" },
  hard:   { bg: "#fee2e2", color: "#991b1b" },
};

export default function TeacherPage() {
  const router = useRouter();
  const { user, isReady } = useUser();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [submissions, setSubmissions] = useState<Record<number, Submission[]>>({});
  const [loadingSubmissions, setLoadingSubmissions] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [generatingReport, setGeneratingReport] = useState(false);

  // Form state
  const [form, setForm] = useState({
    title: "", subject: "", topic: "", difficulty: "medium",
    class_: user?.class_ || "8", instructions: "", due_date: "",
  });
  const [subjects, setSubjects] = useState<string[]>([]);
  const [topics, setTopics] = useState<string[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  useEffect(() => {
    if (isReady && !user) router.push("/onboard");
    if (isReady && user && !["teacher", "admin"].includes(user.role || "")) {
      router.push("/dashboard");
    }
  }, [isReady, user, router]);

  useEffect(() => {
    if (!user?.user_id) return;
    void loadAssignments();
  }, [user?.user_id]);

  useEffect(() => {
    const s = getSubjectsForClass(form.class_) as unknown as string[];
    setSubjects(s);
    if (!s.includes(form.subject)) setForm((f) => ({ ...f, subject: s[0] || "", topic: "" }));
  }, [form.class_]);

  useEffect(() => {
    if (!form.subject || !form.class_) { setTopics([]); return; }
    const t = getTopicsForSubjectAndClass(form.subject, form.class_);
    setTopics(t);
    if (!t.includes(form.topic)) setForm((f) => ({ ...f, topic: t[0] || "" }));
  }, [form.subject, form.class_]);

  const loadAssignments = async () => {
    if (!user?.user_id) return;
    setLoading(true);
    try {
      const data = await api.listAssignments({ teacher_id: user.user_id });
      setAssignments(Array.isArray(data) ? data : []);
    } catch {
      setAssignments([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.user_id || !form.title.trim() || !form.topic.trim()) {
      setFormError("Please fill in all required fields.");
      return;
    }
    setCreating(true);
    setFormError("");
    setFormSuccess("");
    try {
      await api.createAssignment({
        teacher_id: user.user_id,
        organization_id: user.organization_id || 1,
        title: form.title,
        subject: form.subject,
        topic: form.topic,
        difficulty: form.difficulty,
        class_: form.class_,
        instructions: form.instructions,
        due_date: form.due_date || null,
      });
      setFormSuccess("Assignment created successfully!");
      setForm((f) => ({ ...f, title: "", instructions: "", due_date: "" }));
      setShowForm(false);
      await loadAssignments();
    } catch {
      setFormError("Could not create assignment. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  const toggleSubmissions = async (id: number) => {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    if (submissions[id]) return;
    setLoadingSubmissions(id);
    try {
      const data = await api.getAssignmentSubmissions(id);
      setSubmissions((prev) => ({ ...prev, [id]: data.submissions || [] }));
    } catch {
      setSubmissions((prev) => ({ ...prev, [id]: [] }));
    } finally {
      setLoadingSubmissions(null);
    }
  };

  const handleDelete = async (id: number) => {
    if (!user?.user_id || !confirm("Delete this assignment? Students will no longer see it.")) return;
    setDeletingId(id);
    try {
      await api.deleteAssignment(id, user.user_id);
      await loadAssignments();
    } catch {
      alert("Could not delete. Please try again.");
    } finally {
      setDeletingId(null);
    }
  };

  const handleExportReport = async () => {
    if (!user?.user_id) return;
    setGeneratingReport(true);
    try {
      const data = await api.getStudentReportData(user.user_id);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `sakhi-report-${user.name?.replace(/\s+/g, "-") || "teacher"}-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("Could not generate report right now.");
    } finally {
      setGeneratingReport(false);
    }
  };

  const totalStudents  = assignments.reduce((s, a) => Math.max(s, a.submission_count), 0);
  const totalCompleted = assignments.reduce((s, a) => s + (a.completed_count || 0), 0);
  const pendingCount   = assignments.filter((a) => !a.is_overdue).length;
  const overdueCount   = assignments.filter((a) => a.is_overdue).length;

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main-content" style={{ overflowY: "auto", padding: "28px 32px" }}>
        <div style={{ maxWidth: 860, margin: "0 auto" }}>

          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.4px", color: "var(--text-primary)", marginBottom: 4 }}>
                Teacher Dashboard 🎓
              </h1>
              <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
                Create assignments, track student progress, and export reports.
              </p>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                className="btn btn-secondary btn-sm"
                onClick={handleExportReport}
                disabled={generatingReport}
              >
                <Download size={14} />
                {generatingReport ? "Generating…" : "Export Report"}
              </button>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => { setShowForm((v) => !v); setFormError(""); setFormSuccess(""); }}
              >
                <Plus size={14} /> New Assignment
              </button>
            </div>
          </div>

          {/* Stat row */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
            {[
              { label: "Assignments",   value: assignments.length, icon: ClipboardList, color: "#0d9488" },
              { label: "Submissions",   value: totalCompleted,     icon: CheckCircle2,  color: "#059669" },
              { label: "Active",        value: pendingCount,       icon: Clock,         color: "#f59e0b" },
              { label: "Overdue",       value: overdueCount,       icon: AlertCircle,   color: "#ef4444" },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="card" style={{ padding: "16px 18px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <Icon size={15} style={{ color }} />
                  <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>{label}</span>
                </div>
                <div style={{ fontSize: 26, fontWeight: 800, color: "var(--text-primary)" }}>{value}</div>
              </div>
            ))}
          </div>

          {/* Create assignment form */}
          <AnimatePresence>
            {showForm && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="card"
                style={{ padding: 24, marginBottom: 24, border: "1.5px solid var(--emerald)", background: "#f0fdf4" }}
              >
                <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 18 }}>
                  <Plus size={15} style={{ verticalAlign: "middle", marginRight: 6 }} />
                  Create Assignment
                </h2>
                <form onSubmit={(e) => void handleCreate(e)}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                    <div style={{ gridColumn: "1/-1" }}>
                      <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", display: "block", marginBottom: 4 }}>
                        Assignment Title *
                      </label>
                      <input
                        className="input"
                        placeholder="e.g. Chapter 3 Quiz — Photosynthesis"
                        value={form.title}
                        onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                        required
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", display: "block", marginBottom: 4 }}>Class</label>
                      <select className="input input-select" value={form.class_}
                        onChange={(e) => setForm((f) => ({ ...f, class_: e.target.value }))}>
                        {["6","7","8","9","10","11","12"].map((c) => <option key={c} value={c}>Class {c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", display: "block", marginBottom: 4 }}>Subject</label>
                      <select className="input input-select" value={form.subject}
                        onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}>
                        {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", display: "block", marginBottom: 4 }}>Topic *</label>
                      <select className="input input-select" value={form.topic}
                        onChange={(e) => setForm((f) => ({ ...f, topic: e.target.value }))}>
                        {topics.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", display: "block", marginBottom: 4 }}>Difficulty</label>
                      <select className="input input-select" value={form.difficulty}
                        onChange={(e) => setForm((f) => ({ ...f, difficulty: e.target.value }))}>
                        {DIFFICULTIES.map((d) => <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", display: "block", marginBottom: 4 }}>Due Date (optional)</label>
                      <input className="input" type="date" value={form.due_date}
                        onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))} />
                    </div>
                    <div style={{ gridColumn: "1/-1" }}>
                      <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", display: "block", marginBottom: 4 }}>Instructions (optional)</label>
                      <textarea className="input" rows={2} placeholder="Instructions for students…" value={form.instructions}
                        onChange={(e) => setForm((f) => ({ ...f, instructions: e.target.value }))}
                        style={{ resize: "vertical", lineHeight: 1.5 }} />
                    </div>
                  </div>
                  {formError && <p style={{ fontSize: 13, color: "#dc2626", marginBottom: 10 }}>{formError}</p>}
                  {formSuccess && <p style={{ fontSize: 13, color: "#059669", marginBottom: 10 }}>{formSuccess}</p>}
                  <div style={{ display: "flex", gap: 8 }}>
                    <button type="submit" className="btn btn-primary" disabled={creating}>
                      {creating ? "Creating…" : "Create Assignment"}
                    </button>
                    <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>
                      Cancel
                    </button>
                  </div>
                </form>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Assignment list */}
          {loading ? (
            <div style={{ textAlign: "center", padding: 60, color: "var(--text-muted)", fontSize: 14 }}>
              Loading assignments…
            </div>
          ) : assignments.length === 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="card" style={{ textAlign: "center", padding: "56px 24px" }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
              <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 8 }}>No assignments yet</h2>
              <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 20 }}>
                Create your first assignment to get started. Students in your class will see it on their Dashboard.
              </p>
              <button className="btn btn-primary" onClick={() => setShowForm(true)}>
                <Plus size={14} /> Create Assignment
              </button>
            </motion.div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {assignments.map((a) => {
                const badge = BADGE_COLORS[a.difficulty] || BADGE_COLORS.medium;
                const completionPct = a.submission_count > 0
                  ? Math.round((a.completed_count / a.submission_count) * 100) : 0;
                return (
                  <motion.div key={a.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                    className="card" style={{ padding: 0, overflow: "hidden" }}>
                    {/* Card header */}
                    <div style={{ padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                          <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>{a.title}</span>
                          <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 99, ...badge }}>
                            {a.difficulty}
                          </span>
                          {a.is_overdue && (
                            <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 99, background: "#fee2e2", color: "#991b1b" }}>
                              Overdue
                            </span>
                          )}
                        </div>
                        <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: 0 }}>
                          {a.subject} · {a.topic} · Class {a.class_}
                          {a.due_date && ` · Due ${new Date(a.due_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`}
                        </p>
                      </div>
                      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => void toggleSubmissions(a.id)}
                          style={{ fontSize: 12 }}
                        >
                          <Users size={13} /> {a.completed_count}/{a.submission_count}
                          {expandedId === a.id ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        </button>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => void handleDelete(a.id)}
                          disabled={deletingId === a.id}
                          style={{ color: "#dc2626", borderColor: "#fecaca" }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    {/* Completion bar */}
                    <div style={{ padding: "0 20px 14px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Completion</span>
                        <span style={{ fontSize: 11, fontWeight: 600, color: "var(--emerald)" }}>{completionPct}%</span>
                      </div>
                      <div className="progress-track">
                        <div className="progress-fill" style={{ width: `${completionPct}%` }} />
                      </div>
                    </div>

                    {/* Submissions panel */}
                    <AnimatePresence>
                      {expandedId === a.id && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          style={{ borderTop: "1px solid var(--border-subtle)", overflow: "hidden" }}
                        >
                          <div style={{ padding: "16px 20px" }}>
                            <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, color: "var(--text-primary)" }}>
                              Student Submissions
                            </h3>
                            {loadingSubmissions === a.id ? (
                              <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Loading…</p>
                            ) : (submissions[a.id] || []).length === 0 ? (
                              <p style={{ fontSize: 13, color: "var(--text-muted)" }}>No submissions yet.</p>
                            ) : (
                              <table className="lb-table">
                                <thead>
                                  <tr>
                                    <th>Student</th>
                                    <th>Score</th>
                                    <th>%</th>
                                    <th>Submitted</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {(submissions[a.id] || []).map((s) => (
                                    <tr key={s.id}>
                                      <td style={{ fontWeight: 600 }}>{s.student_name}</td>
                                      <td>{s.score}/{s.total_questions}</td>
                                      <td style={{ color: s.score / s.total_questions >= 0.7 ? "var(--emerald)" : "#dc2626", fontWeight: 700 }}>
                                        {Math.round((s.score / s.total_questions) * 100)}%
                                      </td>
                                      <td style={{ color: "var(--text-muted)" }}>
                                        {new Date(s.submitted_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
