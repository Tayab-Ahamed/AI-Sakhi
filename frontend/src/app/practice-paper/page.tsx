"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { useUser } from "@/lib/user-context";
import { api } from "@/lib/api";
import { FileText, Download, Loader2, ChevronDown, ChevronRight, Printer } from "lucide-react";
import { getSubjectsForClass } from "@/lib/curriculum";

type Question = {
  number: number;
  question: string;
  options: string[] | null;
  marks: number;
  model_answer: string;
};

type Section = {
  name: string;
  marks_per_question: number;
  instructions: string;
  questions: Question[];
};

type Paper = {
  title: string;
  subject: string;
  class_: string;
  total_marks: number;
  time_allowed: string;
  general_instructions: string[];
  sections: Section[];
};

export default function PracticePaperPage() {
  const { user, isReady } = useUser();
  const router = useRouter();
  const [topic, setTopic] = useState("");
  const [subject, setSubject] = useState("Science");
  const [numQuestions, setNumQuestions] = useState(10);
  const [showAnswers, setShowAnswers] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set([0, 1, 2]));
  const [paper, setPaper] = useState<Paper | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (isReady && !user) { router.push("/onboard"); return null; }

  const subjects = user ? getSubjectsForClass(user.class_).map(s => s.label) : ["Science", "Mathematics", "Social Science", "English", "Hindi"];

  const generate = async () => {
    if (!topic.trim() || !user) return;
    setLoading(true);
    setError("");
    setPaper(null);
    try {
      const result = await api.generatePracticePaper({
        topic: topic.trim(),
        class_: user.class_,
        subject,
        language: user.language || "English",
        num_questions: numQuestions,
        user_id: user.user_id,
      }) as unknown as Paper;
      setPaper(result);
      setExpandedSections(new Set(result.sections.map((_, i) => i)));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to generate paper");
    } finally {
      setLoading(false);
    }
  };

  const toggleSection = (i: number) => {
    setExpandedSections(prev => {
      const s = new Set(prev);
      if (s.has(i)) s.delete(i); else s.add(i);
      return s;
    });
  };

  const handlePrint = () => window.print();

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content" style={{ overflowY: "auto", padding: "32px 28px" }}>
        <div style={{ maxWidth: 780, margin: "0 auto" }}>

          {/* Header */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
              <div style={{ width: 40, height: 40, borderRadius: "var(--radius-md)", background: "linear-gradient(135deg, #7c3aed, #4f46e5)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <FileText size={20} color="white" />
              </div>
              <h1 style={{ fontSize: 22, fontWeight: 700 }}>Practice Paper Generator</h1>
            </div>
            <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
              Generate a full CBSE-style exam paper with model answers for any topic.
            </p>
          </div>

          {/* Controls */}
          <div className="card" style={{ padding: 24, marginBottom: 24 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>Topic *</label>
                <input
                  className="input"
                  placeholder="e.g. Photosynthesis, Quadratic Equations…"
                  value={topic}
                  onChange={e => setTopic(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && generate()}
                  style={{ width: "100%" }}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>Subject</label>
                <select className="input" value={subject} onChange={e => setSubject(e.target.value)} style={{ width: "100%", cursor: "pointer" }}>
                  {subjects.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>No. of Questions: {numQuestions}</label>
                <input type="range" min={5} max={20} value={numQuestions} onChange={e => setNumQuestions(Number(e.target.value))}
                  style={{ width: "100%", accentColor: "var(--emerald)" }} />
              </div>
              <button
                className="btn btn-primary"
                onClick={generate}
                disabled={loading || !topic.trim()}
                style={{ opacity: (loading || !topic.trim()) ? 0.6 : 1, minWidth: 140, flexShrink: 0 }}
              >
                {loading ? <><Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> Generating…</> : "Generate Paper"}
              </button>
            </div>
          </div>

          {error && (
            <div style={{ padding: "12px 16px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "var(--radius-md)", color: "#dc2626", fontSize: 13, marginBottom: 20 }}>
              {error}
            </div>
          )}

          {loading && (
            <div className="card" style={{ padding: 60, textAlign: "center" }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>📝</div>
              <p style={{ color: "var(--text-secondary)", fontWeight: 500 }}>Crafting your exam paper…</p>
              <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 6 }}>This may take 15–25 seconds</p>
            </div>
          )}

          {paper && (
            <div>
              {/* Paper Header */}
              <div className="card" style={{ padding: 28, marginBottom: 16, textAlign: "center", borderTop: "4px solid var(--emerald)" }}>
                <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>{paper.title}</h2>
                <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 12 }}>
                  Subject: {paper.subject} | Class: {paper.class_} | Total Marks: {paper.total_marks} | Time: {paper.time_allowed}
                </p>
                <div style={{ display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap" }}>
                  <button
                    className="btn btn-secondary"
                    onClick={() => setShowAnswers(s => !s)}
                    style={{ gap: 6, fontSize: 13 }}
                  >
                    {showAnswers ? "🙈 Hide Answers" : "👁️ Show Model Answers"}
                  </button>
                  <button className="btn btn-secondary" onClick={handlePrint} style={{ gap: 6, fontSize: 13 }}>
                    <Printer size={14} /> Print Paper
                  </button>
                </div>
              </div>

              {/* General Instructions */}
              {paper.general_instructions?.length > 0 && (
                <div className="card" style={{ padding: 20, marginBottom: 16 }}>
                  <h3 style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", marginBottom: 10 }}>General Instructions</h3>
                  <ol style={{ paddingLeft: 20, display: "flex", flexDirection: "column", gap: 4 }}>
                    {paper.general_instructions.map((inst, i) => (
                      <li key={i} style={{ fontSize: 13, color: "var(--text-secondary)" }}>{inst}</li>
                    ))}
                  </ol>
                </div>
              )}

              {/* Sections */}
              {paper.sections?.map((section, si) => (
                <div className="card" key={si} style={{ marginBottom: 14, overflow: "hidden" }}>
                  <button
                    onClick={() => toggleSection(si)}
                    style={{ width: "100%", padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "none", border: "none", cursor: "pointer", borderBottom: expandedSections.has(si) ? "1px solid var(--border-subtle)" : "none" }}
                  >
                    <div>
                      <span style={{ fontWeight: 700, fontSize: 14, color: "var(--text-primary)" }}>{section.name}</span>
                      <span style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: 10 }}>({section.questions.length} questions · {section.marks_per_question} mark each)</span>
                    </div>
                    {expandedSections.has(si) ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </button>

                  {expandedSections.has(si) && (
                    <div style={{ padding: "4px 20px 20px" }}>
                      <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "10px 0 16px", fontStyle: "italic" }}>{section.instructions}</p>
                      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                        {section.questions.map((q) => (
                          <div key={q.number} style={{ paddingLeft: 12, borderLeft: "3px solid var(--emerald-light)" }}>
                            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                              <span style={{ fontWeight: 700, fontSize: 14, color: "var(--text-primary)", minWidth: 24 }}>Q{q.number}.</span>
                              <div style={{ flex: 1 }}>
                                <span style={{ fontSize: 14, color: "var(--text-primary)", lineHeight: 1.6 }}>{q.question}</span>
                                <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 8 }}>[{q.marks} mark{q.marks > 1 ? "s" : ""}]</span>
                              </div>
                            </div>
                            {q.options && (
                              <div style={{ paddingLeft: 32, display: "flex", flexDirection: "column", gap: 4, marginBottom: 8 }}>
                                {q.options.map((opt, oi) => (
                                  <span key={oi} style={{ fontSize: 13, color: "var(--text-secondary)" }}>{opt}</span>
                                ))}
                              </div>
                            )}
                            {showAnswers && (
                              <div style={{ marginLeft: 32, marginTop: 8, padding: "8px 12px", background: "var(--emerald-light)", borderRadius: "var(--radius-md)", fontSize: 13, color: "var(--emerald-dark)", borderLeft: "3px solid var(--emerald)" }}>
                                <strong>Model Answer:</strong> {q.model_answer}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
