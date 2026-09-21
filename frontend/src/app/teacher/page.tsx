"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { api } from "@/lib/api";
import { useUser } from "@/lib/user-context";
import { getSubjectsForClass, getTopicsForSubjectAndClass } from "@/lib/curriculum";
import {
  Plus, Trash2, Users, BookOpen, CheckCircle2, Clock,
  ClipboardList, Download, ChevronDown, ChevronUp, BarChart2, AlertCircle,
  Flame, Edit2, Check, X, Filter,
} from "lucide-react";

type BankQuestion = {
  id: number;
  organization_id: number;
  created_by: number;
  board: string;
  class_level: string;
  subject: string;
  chapter?: string;
  learning_outcome?: string;
  question_type: string;
  difficulty: string;
  question_text: string;
  options: string[];
  correct_answer: string;
  explanation: string;
  misconception_tag?: string;
  status: "draft" | "approved" | "rejected";
  created_at: string;
  updated_at: string;
};

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
  feedback_note?: string;
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

  // New Analytics & Roster states
  const [analytics, setAnalytics] = useState<{
    quiz_average: number;
    completion_rate: number;
    struggling_count: number;
    active_assignments: number;
    total_students: number;
  } | null>(null);
  const [roster, setRoster] = useState<{
    user_id: number;
    name: string;
    class_: string;
    weak_subject: string | null;
    streak: number;
    xp: number;
  }[]>([]);

  // Feedback note states
  const [editingFeedbackId, setEditingFeedbackId] = useState<number | null>(null);
  const [feedbackText, setFeedbackText] = useState("");
  const [savingFeedback, setSavingFeedback] = useState(false);
  const [feedbackSuggestions, setFeedbackSuggestions] = useState<string[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  // Assignment edit state
  const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null);
  const [editForm, setEditForm] = useState({ title: "", subject: "", topic: "", difficulty: "medium", instructions: "", due_date: "" });
  const [savingEdit, setSavingEdit] = useState(false);

  // Form state
  const defaultClass = user?.class_ || "8";
  const initialSubjects = (getSubjectsForClass(defaultClass) || []) as unknown as string[];
  const initialSubject = initialSubjects[0] || "Science";
  const initialTopics = getTopicsForSubjectAndClass(initialSubject, defaultClass) || [];

  const [form, setForm] = useState({
    title: "", subject: initialSubject, topic: initialTopics[0] || "", difficulty: "medium",
    class_: defaultClass, instructions: "", due_date: "",
  });
  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  const subjects = (getSubjectsForClass(form.class_) || []) as unknown as string[];
  const topics = (form.subject && form.class_ ? getTopicsForSubjectAndClass(form.subject, form.class_) : []) as string[];

  // Question Bank states
  const [activeTab, setActiveTab] = useState<"assignments" | "question_bank">("assignments");
  const [questionsList, setQuestionsList] = useState<BankQuestion[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [questionStatusFilter, setQuestionStatusFilter] = useState<"all" | "draft" | "approved">("all");
  const [questionSubjectFilter, setQuestionSubjectFilter] = useState<string>("");
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [savingQuestion, setSavingQuestion] = useState(false);
  const [questionFormError, setQuestionFormError] = useState("");
  const [newQuestion, setNewQuestion] = useState({
    board: "CBSE",
    class_level: "8",
    subject: "Science",
    chapter: "",
    learning_outcome: "",
    question_type: "mcq",
    difficulty: "medium",
    question_text: "",
    options: ["", "", "", ""],
    correct_answer: "",
    explanation: "",
    misconception_tag: "",
  });

  const onClassChange = (c: string) => {
    const s = (getSubjectsForClass(c) || []) as unknown as string[];
    const firstSub = s[0] || "";
    const t = firstSub ? getTopicsForSubjectAndClass(firstSub, c) : [];
    setForm((f) => ({ ...f, class_: c, subject: firstSub, topic: t[0] || "" }));
  };

  const onSubjectChange = (subj: string) => {
    const t = getTopicsForSubjectAndClass(subj, form.class_);
    setForm((f) => ({ ...f, subject: subj, topic: t[0] || "" }));
  };

  const loadQuestionBank = async () => {
    setLoadingQuestions(true);
    try {
      const res = await api.getQuestions(
        questionStatusFilter === "all" ? undefined : questionStatusFilter,
        questionSubjectFilter || undefined
      );
      setQuestionsList((res as { questions?: BankQuestion[] }).questions || []);
    } catch {
      setQuestionsList([]);
    } finally {
      setLoadingQuestions(false);
    }
  };

  const handleCreateBankQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuestion.question_text.trim() || !newQuestion.correct_answer.trim()) {
      setQuestionFormError("Please enter question text and correct answer.");
      return;
    }
    const cleanOptions = newQuestion.options.map((o) => o.trim()).filter(Boolean);
    if (newQuestion.question_type === "mcq" && cleanOptions.length < 2) {
      setQuestionFormError("MCQ questions require at least 2 options.");
      return;
    }
    setSavingQuestion(true);
    setQuestionFormError("");
    try {
      await api.createQuestion({
        ...newQuestion,
        options: cleanOptions,
      });
      setShowQuestionModal(false);
      setNewQuestion({
        board: "CBSE",
        class_level: "8",
        subject: "Science",
        chapter: "",
        learning_outcome: "",
        question_type: "mcq",
        difficulty: "medium",
        question_text: "",
        options: ["", "", "", ""],
        correct_answer: "",
        explanation: "",
        misconception_tag: "",
      });
      await loadQuestionBank();
    } catch (err) {
      setQuestionFormError(err instanceof Error ? err.message : "Failed to create question");
    } finally {
      setSavingQuestion(false);
    }
  };

  const handleReviewQuestion = async (questionId: number, status: "approved" | "rejected") => {
    try {
      await api.reviewQuestion(questionId, status, `Reviewed by teacher ${user?.name || ""}`);
      await loadQuestionBank();
    } catch {
      alert("Could not update question status.");
    }
  };

  const loadTeacherData = async () => {
    if (!user?.user_id || !["teacher", "admin"].includes(user.role || "")) return;
    await Promise.resolve();
    setLoading(true);
    try {
      const orgId = user.organization_id || 1;
      const [assignData, analyticsData, rosterData, qData] = await Promise.all([
        api.listAssignments({ teacher_id: user.user_id }),
        api.getClassAnalytics(orgId),
        api.getOrganizationRoster(orgId),
        api.getQuestions().catch(() => ({ questions: [] })),
      ]);
      setAssignments(assignData as unknown as Assignment[]);
      setAnalytics(analyticsData as {
        quiz_average: number;
        completion_rate: number;
        struggling_count: number;
        active_assignments: number;
        total_students: number;
      });
      setRoster((rosterData as { roster?: typeof roster }).roster || []);
      setQuestionsList((qData as { questions?: BankQuestion[] }).questions || []);
    } catch {
      setAssignments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isReady && !user) router.push("/onboard");
    if (isReady && user && !["teacher", "admin"].includes(user.role || "")) {
      router.push("/dashboard");
    }
  }, [isReady, user, router]);

  useEffect(() => {
    if (!user?.user_id || !["teacher", "admin"].includes(user.role || "")) return;
    let cancelled = false;
    Promise.resolve().then(() => {
      if (!cancelled) void loadTeacherData();
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.user_id, user?.role, user?.organization_id]);

  const handleSaveFeedback = async (submissionId: number, assignmentId: number) => {
    if (!feedbackText.trim()) return;
    setSavingFeedback(true);
    try {
      const updated = await api.updateSubmissionFeedback(submissionId, feedbackText) as { feedback_note?: string };
      setSubmissions((prev) => {
        const list = prev[assignmentId] || [];
        return {
          ...prev,
          [assignmentId]: list.map((sub) =>
            sub.id === submissionId ? { ...sub, feedback_note: updated.feedback_note } : sub
          ),
        };
      });
      setEditingFeedbackId(null);
      setFeedbackText("");
      setFeedbackSuggestions([]);
    } catch {
      alert("Could not save feedback. Please try again.");
    } finally {
      setSavingFeedback(false);
    }
  };

  const handleGetFeedbackSuggestions = async (submission: Submission, assignment: Assignment) => {
    setLoadingSuggestions(true);
    try {
      const data = await api.getFeedbackSuggestions({
        topic: assignment.topic,
        score: submission.score,
        total: submission.total_questions,
        student_name: submission.student_name,
        language: user?.language || "English",
      }) as { suggestions?: string[] };
      setFeedbackSuggestions(data.suggestions || []);
    } catch {
      setFeedbackSuggestions([]);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const handleEditAssignment = (a: Assignment) => {
    setEditingAssignment(a);
    setEditForm({ title: a.title, subject: a.subject, topic: a.topic, difficulty: a.difficulty, instructions: a.instructions || "", due_date: a.due_date || "" });
  };

  const handleSaveEdit = async () => {
    if (!editingAssignment) return;
    setSavingEdit(true);
    try {
      await api.updateAssignment(editingAssignment.id, editForm);
      setAssignments(prev => prev.map(a => a.id === editingAssignment.id ? { ...a, ...editForm } : a));
      setEditingAssignment(null);
    } catch {
      alert("Could not update assignment.");
    } finally {
      setSavingEdit(false);
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
      await loadTeacherData();
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
      const data = await api.getAssignmentSubmissions(id) as { submissions?: Submission[] };
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
      await loadTeacherData();
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

  const totalCompleted = assignments.reduce((s, a) => s + (a.completed_count || 0), 0);
  const pendingCount   = assignments.filter((a) => !a.is_overdue).length;
  const overdueCount   = assignments.filter((a) => a.is_overdue).length;

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

  if (!user || !["teacher", "admin"].includes(user.role || "")) {
    return null;
  }

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
              {activeTab === "assignments" ? (
                <>
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
                </>
              ) : (
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => { setShowQuestionModal(true); setQuestionFormError(""); }}
                >
                  <Plus size={14} /> Add NCERT Question
                </button>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", gap: 8, marginBottom: 24, borderBottom: "1px solid var(--border)", paddingBottom: 10 }}>
            <button
              onClick={() => setActiveTab("assignments")}
              className={`btn btn-sm ${activeTab === "assignments" ? "btn-primary" : "btn-secondary"}`}
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <ClipboardList size={14} /> Assignments & Insights
            </button>
            <button
              onClick={() => { setActiveTab("question_bank"); void loadQuestionBank(); }}
              className={`btn btn-sm ${activeTab === "question_bank" ? "btn-primary" : "btn-secondary"}`}
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <BookOpen size={14} /> Curriculum Question Bank ({questionsList.length})
            </button>
          </div>

          {/* ── Edit Assignment Modal ─────────────────────────────── */}
          <AnimatePresence>
            {editingAssignment && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
                onClick={(e) => { if (e.target === e.currentTarget) setEditingAssignment(null); }}
              >
                <motion.div
                  initial={{ scale: 0.95, y: 16, opacity: 0 }}
                  animate={{ scale: 1, y: 0, opacity: 1 }}
                  exit={{ scale: 0.95, y: 16, opacity: 0 }}
                  className="card"
                  style={{ width: "100%", maxWidth: 540, padding: 28, boxShadow: "var(--shadow-lg)" }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                    <h2 style={{ fontSize: 17, fontWeight: 800, color: "var(--text-primary)", margin: 0 }}>Edit Assignment</h2>
                    <button onClick={() => setEditingAssignment(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4 }}>
                      <X size={18} />
                    </button>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Title *</label>
                      <input className="input" value={editForm.title} onChange={(e) => setEditForm(f => ({ ...f, title: e.target.value }))} placeholder="Assignment title" />
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Subject</label>
                        <input className="input" value={editForm.subject} onChange={(e) => setEditForm(f => ({ ...f, subject: e.target.value }))} placeholder="Subject" />
                      </div>
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Topic</label>
                        <input className="input" value={editForm.topic} onChange={(e) => setEditForm(f => ({ ...f, topic: e.target.value }))} placeholder="Topic" />
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Difficulty</label>
                        <select className="input" value={editForm.difficulty} onChange={(e) => setEditForm(f => ({ ...f, difficulty: e.target.value }))}>
                          {DIFFICULTIES.map(d => <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Due Date</label>
                        <input className="input" type="date" value={editForm.due_date} onChange={(e) => setEditForm(f => ({ ...f, due_date: e.target.value }))} />
                      </div>
                    </div>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Instructions</label>
                      <textarea className="input" rows={3} value={editForm.instructions} onChange={(e) => setEditForm(f => ({ ...f, instructions: e.target.value }))} placeholder="Instructions for students…" style={{ resize: "vertical" }} />
                    </div>
                    <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => setEditingAssignment(null)}>Cancel</button>
                      <button className="btn btn-primary btn-sm" onClick={() => void handleSaveEdit()} disabled={savingEdit}>
                        {savingEdit ? "Saving…" : <><Check size={13} /> Save Changes</>}
                      </button>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── New Question Modal ─────────────────────────────── */}
          <AnimatePresence>
            {showQuestionModal && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
                onClick={(e) => { if (e.target === e.currentTarget) setShowQuestionModal(false); }}
              >
                <motion.div
                  initial={{ scale: 0.95, y: 16, opacity: 0 }}
                  animate={{ scale: 1, y: 0, opacity: 1 }}
                  exit={{ scale: 0.95, y: 16, opacity: 0 }}
                  className="card"
                  style={{ width: "100%", maxWidth: 600, padding: 28, maxHeight: "90vh", overflowY: "auto", boxShadow: "var(--shadow-lg)" }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
                    <h2 style={{ fontSize: 17, fontWeight: 800, color: "var(--text-primary)", margin: 0 }}>Add Curriculum Question</h2>
                    <button onClick={() => setShowQuestionModal(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4 }}>
                      <X size={18} />
                    </button>
                  </div>

                  {questionFormError && (
                    <div style={{ padding: "8px 12px", background: "#fee2e2", color: "#991b1b", borderRadius: 6, fontSize: 12, marginBottom: 14 }}>
                      {questionFormError}
                    </div>
                  )}

                  <form onSubmit={(e) => void handleCreateBankQuestion(e)}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 12 }}>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 600, display: "block", marginBottom: 4 }}>Board</label>
                        <select className="input" value={newQuestion.board} onChange={(e) => setNewQuestion(q => ({ ...q, board: e.target.value }))}>
                          <option value="CBSE">CBSE / NCERT</option>
                          <option value="ICSE">ICSE</option>
                          <option value="State Board">State Board</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 600, display: "block", marginBottom: 4 }}>Class Level</label>
                        <select className="input" value={newQuestion.class_level} onChange={(e) => setNewQuestion(q => ({ ...q, class_level: e.target.value }))}>
                          {["6","7","8","9","10","11","12"].map(c => <option key={c} value={c}>Class {c}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 600, display: "block", marginBottom: 4 }}>Difficulty</label>
                        <select className="input" value={newQuestion.difficulty} onChange={(e) => setNewQuestion(q => ({ ...q, difficulty: e.target.value }))}>
                          <option value="easy">Easy</option>
                          <option value="medium">Medium</option>
                          <option value="hard">Hard</option>
                        </select>
                      </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 600, display: "block", marginBottom: 4 }}>Subject *</label>
                        <input className="input" value={newQuestion.subject} onChange={(e) => setNewQuestion(q => ({ ...q, subject: e.target.value }))} placeholder="Science" required />
                      </div>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 600, display: "block", marginBottom: 4 }}>Chapter</label>
                        <input className="input" value={newQuestion.chapter} onChange={(e) => setNewQuestion(q => ({ ...q, chapter: e.target.value }))} placeholder="Light & Reflection" />
                      </div>
                    </div>

                    <div style={{ marginBottom: 12 }}>
                      <label style={{ fontSize: 11, fontWeight: 600, display: "block", marginBottom: 4 }}>Question Text *</label>
                      <textarea className="input" rows={3} value={newQuestion.question_text} onChange={(e) => setNewQuestion(q => ({ ...q, question_text: e.target.value }))} placeholder="Enter question..." required />
                    </div>

                    <div style={{ marginBottom: 12 }}>
                      <label style={{ fontSize: 11, fontWeight: 600, display: "block", marginBottom: 6 }}>Options (for MCQ)</label>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                        {newQuestion.options.map((opt, idx) => (
                          <div key={idx} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ fontSize: 12, fontWeight: 700 }}>{String.fromCharCode(65 + idx)}:</span>
                            <input
                              className="input"
                              value={opt}
                              onChange={(e) => {
                                const copy = [...newQuestion.options];
                                copy[idx] = e.target.value;
                                setNewQuestion(q => ({ ...q, options: copy }));
                              }}
                              placeholder={`Option ${String.fromCharCode(65 + idx)}`}
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 600, display: "block", marginBottom: 4 }}>Correct Answer *</label>
                        <input className="input" value={newQuestion.correct_answer} onChange={(e) => setNewQuestion(q => ({ ...q, correct_answer: e.target.value }))} placeholder="A or exact answer" required />
                      </div>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 600, display: "block", marginBottom: 4 }}>Misconception Tag (Optional)</label>
                        <input className="input" value={newQuestion.misconception_tag} onChange={(e) => setNewQuestion(q => ({ ...q, misconception_tag: e.target.value }))} placeholder="formula_confusion" />
                      </div>
                    </div>

                    <div style={{ marginBottom: 16 }}>
                      <label style={{ fontSize: 11, fontWeight: 600, display: "block", marginBottom: 4 }}>Explanation</label>
                      <textarea className="input" rows={2} value={newQuestion.explanation} onChange={(e) => setNewQuestion(q => ({ ...q, explanation: e.target.value }))} placeholder="Step-by-step reasoning for the correct answer..." />
                    </div>

                    <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowQuestionModal(false)}>Cancel</button>
                      <button type="submit" className="btn btn-primary btn-sm" disabled={savingQuestion}>
                        {savingQuestion ? "Saving…" : <><Check size={13} /> Save for Review</>}
                      </button>
                    </div>
                  </form>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {activeTab === "assignments" ? (
            <>
              {/* Stat row */}
          {/* Class Analytics Panel */}
          {analytics && (
            <div style={{ marginBottom: 28 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <BarChart2 size={18} style={{ color: "var(--emerald)" }} />
                <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Class Performance & Insights</h2>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
                {/* Card 1: Quiz Average */}
                <div className="card" style={{ padding: "20px 22px", background: "linear-gradient(135deg, var(--bg-surface) 0%, rgba(13, 148, 136, 0.05) 100%)", borderLeft: "4px solid #0d9488", boxShadow: "var(--shadow-md)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <span style={{ fontSize: 13, color: "var(--text-secondary)", fontWeight: 600 }}>Class Quiz Average</span>
                    <BarChart2 size={16} style={{ color: "#0d9488" }} />
                  </div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 8 }}>
                    <span style={{ fontSize: 28, fontWeight: 800, color: "var(--text-primary)" }}>{analytics.quiz_average}%</span>
                  </div>
                  <div className="progress-track" style={{ height: 6, background: "rgba(0,0,0,0.06)", borderRadius: 3 }}>
                    <div className="progress-fill" style={{ width: `${analytics.quiz_average}%`, height: "100%", background: "#0d9488", borderRadius: 3 }} />
                  </div>
                </div>

                {/* Card 2: Assignment Completion Rate */}
                <div className="card" style={{ padding: "20px 22px", background: "linear-gradient(135deg, var(--bg-surface) 0%, rgba(5, 150, 105, 0.05) 100%)", borderLeft: "4px solid #059669", boxShadow: "var(--shadow-md)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <span style={{ fontSize: 13, color: "var(--text-secondary)", fontWeight: 600 }}>Assignment Completion</span>
                    <CheckCircle2 size={16} style={{ color: "#059669" }} />
                  </div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 8 }}>
                    <span style={{ fontSize: 28, fontWeight: 800, color: "var(--text-primary)" }}>{analytics.completion_rate}%</span>
                  </div>
                  <div className="progress-track" style={{ height: 6, background: "rgba(0,0,0,0.06)", borderRadius: 3 }}>
                    <div className="progress-fill" style={{ width: `${analytics.completion_rate}%`, height: "100%", background: "#059669", borderRadius: 3 }} />
                  </div>
                </div>

                {/* Card 3: Struggling Students */}
                <div className="card" style={{ padding: "20px 22px", background: "linear-gradient(135deg, var(--bg-surface) 0%, rgba(239, 68, 68, 0.05) 100%)", borderLeft: "4px solid #ef4444", boxShadow: "var(--shadow-md)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <span style={{ fontSize: 13, color: "var(--text-secondary)", fontWeight: 600 }}>Struggling Students</span>
                    <AlertCircle size={16} style={{ color: "#ef4444" }} />
                  </div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                    <span style={{ fontSize: 28, fontWeight: 800, color: "var(--text-primary)" }}>{analytics.struggling_count}</span>
                    <span style={{ fontSize: 12, color: analytics.struggling_count > 0 ? "#dc2626" : "var(--text-muted)", fontWeight: 600 }}>
                      {analytics.struggling_count > 0 ? "needs attention" : "all doing great!"}
                    </span>
                  </div>
                  <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "4px 0 0" }}>Average score below 60%</p>
                </div>
              </div>
            </div>
          )}

          {/* Quick Stats overview */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, marginTop: 12 }}>
            <ClipboardList size={18} style={{ color: "var(--text-secondary)" }} />
            <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Assignment Overview</h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
            {[
              { label: "Total Assignments", value: assignments.length, icon: ClipboardList, color: "#0d9488" },
              { label: "Total Submissions", value: totalCompleted,     icon: CheckCircle2,  color: "#059669" },
              { label: "Active",            value: pendingCount,       icon: Clock,         color: "#f59e0b" },
              { label: "Overdue",           value: overdueCount,       icon: AlertCircle,   color: "#ef4444" },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="card" style={{ padding: "14px 16px", boxShadow: "var(--shadow-sm)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <Icon size={14} style={{ color }} />
                  <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>{label}</span>
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)" }}>{value}</div>
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
                        onChange={(e) => onClassChange(e.target.value)}>
                        {["6","7","8","9","10","11","12"].map((c) => <option key={c} value={c}>Class {c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", display: "block", marginBottom: 4 }}>Subject</label>
                      <select className="input input-select" value={form.subject}
                        onChange={(e) => onSubjectChange(e.target.value)}>
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
                          onClick={() => handleEditAssignment(a)}
                          title="Edit assignment"
                          style={{ fontSize: 12 }}
                        >
                          <Edit2 size={13} />
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
                                    <th>Feedback Note</th>
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
                                      <td>
                                        {editingFeedbackId === s.id ? (
                                          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                                              <input
                                                className="input"
                                                style={{ padding: "4px 8px", fontSize: 12, minWidth: 140, margin: 0 }}
                                                placeholder="Leave a helpful note..."
                                                value={feedbackText}
                                                onChange={(e) => setFeedbackText(e.target.value)}
                                                autoFocus
                                              />
                                              <button
                                                className="btn btn-primary btn-sm"
                                                style={{ padding: "4px 8px", fontSize: 11, height: "auto" }}
                                                onClick={() => void handleSaveFeedback(s.id, a.id)}
                                                disabled={savingFeedback}
                                              >
                                                Save
                                              </button>
                                              <button
                                                className="btn btn-secondary btn-sm"
                                                style={{ padding: "4px 8px", fontSize: 11, height: "auto" }}
                                                onClick={() => { setEditingFeedbackId(null); setFeedbackSuggestions([]); }}
                                              >
                                                Cancel
                                              </button>
                                            </div>
                                            <div style={{ display: "flex", gap: 4, alignItems: "center", flexWrap: "wrap" }}>
                                              <button
                                                className="btn btn-secondary btn-sm"
                                                style={{ fontSize: 10, padding: "2px 6px", height: "auto", opacity: loadingSuggestions ? 0.6 : 1 }}
                                                onClick={() => void handleGetFeedbackSuggestions(s, a)}
                                                disabled={loadingSuggestions}
                                              >
                                                ✨ {loadingSuggestions ? "Getting AI suggestions…" : "AI Suggestions"}
                                              </button>
                                              {feedbackSuggestions.map((sug, i) => (
                                                <button
                                                  key={i}
                                                  onClick={() => setFeedbackText(sug)}
                                                  style={{ fontSize: 10, padding: "2px 8px", height: "auto", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 99, cursor: "pointer", color: "#065f46", fontFamily: "Inter,sans-serif", textAlign: "left", maxWidth: 200, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
                                                  title={sug}
                                                >
                                                  {sug.length > 40 ? sug.substring(0, 37) + "…" : sug}
                                                </button>
                                              ))}
                                            </div>
                                          </div>
                                        ) : (
                                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                                            <span style={{ fontSize: 12, color: s.feedback_note ? "var(--text-primary)" : "var(--text-muted)", fontStyle: s.feedback_note ? "normal" : "italic" }}>
                                              {s.feedback_note || "No feedback left yet."}
                                            </span>
                                            <button
                                              className="btn btn-secondary btn-sm"
                                              style={{ padding: "2px 6px", height: "auto", fontSize: 10 }}
                                              onClick={() => {
                                                setEditingFeedbackId(s.id);
                                                setFeedbackText(s.feedback_note || "");
                                              }}
                                            >
                                              <Edit2 size={10} style={{ marginRight: 2 }} /> {s.feedback_note ? "Edit" : "Add"}
                                            </button>
                                          </div>
                                        )}
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

          {/* Student Roster Section */}
          <div className="card" style={{ marginTop: 32, padding: 24, boxShadow: "var(--shadow-lg)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 36, height: 36, borderRadius: "50%", background: "rgba(5, 150, 105, 0.1)", color: "var(--emerald)" }}>
                <Users size={18} />
              </div>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 800, color: "var(--text-primary)", margin: 0 }}>Class Student Directory</h2>
                <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: 0 }}>Active students registered in your organization.</p>
              </div>
            </div>

            {roster.length === 0 ? (
              <p style={{ fontSize: 14, color: "var(--text-muted)", fontStyle: "italic", textAlign: "center", padding: "20px 0" }}>No students registered yet.</p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="lb-table" style={{ width: "100%" }}>
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>Class</th>
                      <th>Streak</th>
                      <th>XP Points</th>
                      <th>Weak Subject</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roster.map((student) => {
                      // Get initials
                      const initials = student.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
                      // Get XP badge title
                      let xpBadge = { label: "Bronze", color: "#b45309", bg: "#fef3c7" };
                      if (student.xp >= 1000) xpBadge = { label: "Platinum", color: "#0369a1", bg: "#e0f2fe" };
                      else if (student.xp >= 500) xpBadge = { label: "Gold", color: "#a16207", bg: "#fef9c3" };
                      else if (student.xp >= 200) xpBadge = { label: "Silver", color: "#4b5563", bg: "#f3f4f6" };

                      return (
                        <tr key={student.user_id}>
                          <td style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 10px" }}>
                            <div style={{
                              width: 32, height: 32, borderRadius: "50%",
                              background: "linear-gradient(135deg, var(--emerald) 0%, #0d9488 100%)",
                              color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
                              fontSize: 12, fontWeight: 700
                            }}>
                              {initials}
                            </div>
                            <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{student.name}</span>
                          </td>
                          <td style={{ fontWeight: 500 }}>Class {student.class_}</td>
                          <td>
                            <div style={{ display: "flex", alignItems: "center", gap: 4, fontWeight: 700, color: student.streak > 0 ? "#f59e0b" : "var(--text-muted)" }}>
                              <Flame size={14} style={{ fill: student.streak > 0 ? "#f59e0b" : "none" }} />
                              {student.streak} days
                            </div>
                          </td>
                          <td>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <span style={{ fontWeight: 800, color: "var(--text-primary)" }}>{student.xp} XP</span>
                              <span style={{
                                fontSize: 10, fontWeight: 700, padding: "2px 8px",
                                borderRadius: 12, background: xpBadge.bg, color: xpBadge.color
                              }}>
                                {xpBadge.label}
                              </span>
                            </div>
                          </td>
                          <td>
                            {student.weak_subject ? (
                              <span style={{
                                fontSize: 11, fontWeight: 600, padding: "2px 8px",
                                borderRadius: 99, background: "#fee2e2", color: "#ef4444"
                              }}>
                                {student.weak_subject}
                              </span>
                            ) : (
                              <span style={{ fontSize: 12, color: "var(--emerald)", fontWeight: 600 }}>Consistent Mastery</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : (
        <div>
          {/* Question Bank Filter Toolbar */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, gap: 12, flexWrap: "wrap" }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)" }}>Status:</span>
              {(["all", "draft", "approved"] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setQuestionStatusFilter(st)}
                  className={`btn btn-sm ${questionStatusFilter === st ? "btn-primary" : "btn-secondary"}`}
                  style={{ fontSize: 12, padding: "5px 12px", textTransform: "capitalize" }}
                >
                  {st === "all" ? "All Questions" : st === "draft" ? "Pending Review" : "Approved"}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <Filter size={14} style={{ color: "var(--text-muted)" }} />
              <select
                className="input input-select"
                value={questionSubjectFilter}
                onChange={(e) => setQuestionSubjectFilter(e.target.value)}
                style={{ fontSize: 12, padding: "4px 12px", width: "auto" }}
              >
                <option value="">All Subjects</option>
                {["Science", "Mathematics", "Social Studies", "English", "Hindi"].map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => void loadQuestionBank()}
                disabled={loadingQuestions}
              >
                {loadingQuestions ? "Refreshing…" : "Refresh"}
              </button>
            </div>
          </div>

          {/* Questions List */}
          {loadingQuestions ? (
            <div style={{ textAlign: "center", padding: 60 }}>
              <div style={{ width: 28, height: 28, border: "3px solid #e5e7eb", borderTopColor: "var(--emerald)", borderRadius: "50%", animation: "spin 0.7s linear infinite", margin: "0 auto 12px" }} />
              <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Loading questions from bank...</p>
            </div>
          ) : questionsList.length === 0 ? (
            <div className="card" style={{ padding: 48, textAlign: "center", border: "1px dashed var(--border)" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📚</div>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>No Questions Found</h3>
              <p style={{ fontSize: 13, color: "var(--text-secondary)", maxWidth: 420, margin: "0 auto 16px" }}>
                No curriculum questions match your current filters. Add your first verified NCERT question to enrich the school bank.
              </p>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => { setShowQuestionModal(true); setQuestionFormError(""); }}
              >
                <Plus size={14} /> Add First Question
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {questionsList
                .filter(q => questionStatusFilter === "all" || q.status === questionStatusFilter)
                .filter(q => !questionSubjectFilter || q.subject === questionSubjectFilter)
                .map((q) => (
                  <div
                    key={q.id}
                    className="card"
                    style={{
                      padding: 20,
                      borderLeft: `4px solid ${q.status === "approved" ? "#059669" : "#f59e0b"}`,
                      boxShadow: "var(--shadow-sm)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10, gap: 12 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span style={{
                          fontSize: 10,
                          fontWeight: 700,
                          textTransform: "uppercase",
                          padding: "2px 8px",
                          borderRadius: 4,
                          background: q.status === "approved" ? "#ecfdf5" : "#fef3c7",
                          color: q.status === "approved" ? "#059669" : "#d97706",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                        }}>
                          {q.status === "approved" ? "✓ Approved" : "⏳ Pending Review"}
                        </span>
                        <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)" }}>
                          {q.board} · Class {q.class_level} · {q.subject} {q.chapter ? `· ${q.chapter}` : ""}
                        </span>
                        <span style={{
                          fontSize: 10,
                          fontWeight: 700,
                          textTransform: "uppercase",
                          padding: "2px 6px",
                          borderRadius: 4,
                          background: q.difficulty === "hard" ? "#fee2e2" : q.difficulty === "medium" ? "#fef3c7" : "#d1fae5",
                          color: q.difficulty === "hard" ? "#991b1b" : q.difficulty === "medium" ? "#92400e" : "#065f46",
                        }}>
                          {q.difficulty}
                        </span>
                      </div>
                      {q.status === "draft" && (
                        <div style={{ display: "flex", gap: 6 }}>
                          <button
                            className="btn btn-sm"
                            style={{ background: "#059669", color: "white", padding: "3px 10px", fontSize: 11, fontWeight: 700 }}
                            onClick={() => void handleReviewQuestion(q.id, "approved")}
                          >
                            <Check size={12} /> Approve
                          </button>
                          <button
                            className="btn btn-sm btn-ghost"
                            style={{ color: "#ef4444", padding: "3px 8px", fontSize: 11 }}
                            onClick={() => void handleReviewQuestion(q.id, "rejected")}
                          >
                            <X size={12} /> Reject
                          </button>
                        </div>
                      )}
                    </div>

                    <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 12, lineHeight: 1.5 }}>
                      {q.question_text}
                    </div>

                    {q.options && q.options.length > 0 && (
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
                        {q.options.map((opt, oIdx) => {
                          const optLetter = String.fromCharCode(65 + oIdx);
                          const isCorrect = q.correct_answer === optLetter || q.correct_answer === opt;
                          return (
                            <div
                              key={oIdx}
                              style={{
                                fontSize: 12,
                                padding: "6px 10px",
                                borderRadius: 6,
                                background: isCorrect ? "#ecfdf5" : "var(--bg-surface)",
                                border: `1px solid ${isCorrect ? "#10b981" : "var(--border)"}`,
                                color: isCorrect ? "#065f46" : "var(--text-secondary)",
                                fontWeight: isCorrect ? 700 : 500,
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                              }}
                            >
                              <span>{optLetter}.</span>
                              <span>{opt}</span>
                              {isCorrect && <Check size={12} style={{ marginLeft: "auto", color: "#059669" }} />}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {q.explanation && (
                      <div style={{ fontSize: 12, color: "var(--text-secondary)", background: "var(--bg-sidebar)", padding: "8px 12px", borderRadius: 6, marginBottom: 6 }}>
                        <strong>Explanation:</strong> {q.explanation}
                      </div>
                    )}

                    {q.misconception_tag && (
                      <div style={{ fontSize: 11, color: "#b45309", marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
                        <AlertCircle size={12} />
                        <span>Targeted Misconception: <em>{q.misconception_tag}</em></span>
                      </div>
                    )}
                  </div>
                ))}
            </div>
          )}
        </div>
      )}
        </div>
      </main>
    </div>
  );
}
