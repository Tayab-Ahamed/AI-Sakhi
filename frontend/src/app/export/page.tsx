"use client";

/**
 * Phase 16 — PDF Export Page
 * Generates a premium student progress PDF report using jsPDF.
 * No server round-trip — all rendering happens client-side.
 */
import { useState } from "react";
import { motion } from "framer-motion";
import Sidebar from "@/components/Sidebar";
import { api } from "@/lib/api";
import { useUser } from "@/lib/user-context";
import { Download, FileText, BarChart2, Flame, Trophy, AlertCircle } from "lucide-react";

type ReportData = {
  user: { name: string; class_: string; weak_subject: string };
  streak: number;
  avg_quiz_pct: number | null;
  total_quizzes: number;
  quiz_history: Array<{ topic: string; score: number; total: number; timestamp: string }>;
  assignments_completed: Array<{ title: string; topic: string; score: number; total_questions: number; submitted_at: string }>;
  flashcard_stats: { total: number; avg_ef: number };
  generated_at: string;
};

export default function ExportPage() {
  const { user } = useUser();
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<ReportData | null>(null);
  const [error, setError] = useState("");

  const fetchReport = async () => {
    if (!user?.user_id) return;
    setLoading(true);
    setError("");
    try {
      const data = await api.getStudentReportData(user.user_id) as ReportData;
      setPreview(data);
    } catch {
      setError("Could not load report data. Is the backend running?");
    } finally {
      setLoading(false);
    }
  };

  const downloadPdf = async () => {
    if (!preview) return;
    setLoading(true);
    try {
      // Dynamic import so jsPDF isn't bundled in the initial chunk
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ unit: "mm", format: "a4" });

      const PAGE_W = 210;
      const MARGIN = 18;
      const CONTENT_W = PAGE_W - MARGIN * 2;
      let y = 0;

      // ── Header band ───────────────────────────────────────
      doc.setFillColor(5, 150, 105);   // emerald-600
      doc.rect(0, 0, PAGE_W, 36, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(20);
      doc.text("AI Sakhi — Student Report", MARGIN, 16);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Generated: ${new Date(preview.generated_at).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}`, MARGIN, 26);
      doc.text(`Class ${preview.user.class_}  |  ${preview.user.weak_subject ? `Weak in: ${preview.user.weak_subject}` : ""}`, MARGIN, 32);
      y = 46;

      // ── Student name ──────────────────────────────────────
      doc.setTextColor(15, 15, 15);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text(preview.user.name, MARGIN, y);
      y += 10;

      // ── Stat row ──────────────────────────────────────────
      const stats = [
        { label: "Streak",       value: `${preview.streak} days 🔥` },
        { label: "Avg Score",    value: preview.avg_quiz_pct != null ? `${preview.avg_quiz_pct}%` : "–" },
        { label: "Quizzes Done", value: String(preview.total_quizzes) },
        { label: "Flashcards",   value: String(preview.flashcard_stats?.total ?? 0) },
      ];
      const BOX_W = CONTENT_W / 4 - 3;
      stats.forEach(({ label, value }, i) => {
        const x = MARGIN + i * (BOX_W + 4);
        doc.setFillColor(240, 253, 244);
        doc.roundedRect(x, y, BOX_W, 18, 3, 3, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.setTextColor(5, 95, 70);
        doc.text(value, x + BOX_W / 2, y + 9, { align: "center" });
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(100, 100, 100);
        doc.text(label.toUpperCase(), x + BOX_W / 2, y + 15, { align: "center" });
      });
      y += 26;

      // ── Quiz History ──────────────────────────────────────
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(15, 15, 15);
      doc.text("Quiz History", MARGIN, y);
      y += 6;

      // Table header
      doc.setFillColor(229, 231, 235);
      doc.rect(MARGIN, y, CONTENT_W, 7, "F");
      doc.setFontSize(8);
      doc.setTextColor(60, 60, 60);
      doc.text("Topic", MARGIN + 2, y + 5);
      doc.text("Score", MARGIN + CONTENT_W * 0.6, y + 5);
      doc.text("%", MARGIN + CONTENT_W * 0.75, y + 5);
      doc.text("Date", MARGIN + CONTENT_W * 0.85, y + 5);
      y += 8;

      const history = preview.quiz_history.slice(0, 12);
      history.forEach((h, idx) => {
        if (y > 260) { doc.addPage(); y = 20; }
        const pct = h.total ? Math.round((h.score / h.total) * 100) : 0;
        if (idx % 2 === 0) {
          doc.setFillColor(249, 250, 251);
          doc.rect(MARGIN, y - 1, CONTENT_W, 7, "F");
        }
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(30, 30, 30);
        doc.text(h.topic.slice(0, 40), MARGIN + 2, y + 4);
        doc.text(`${h.score}/${h.total}`, MARGIN + CONTENT_W * 0.6, y + 4);
        doc.setTextColor(pct >= 70 ? 5 : pct >= 40 ? 180 : 200, pct >= 70 ? 150 : pct >= 40 ? 120 : 30, pct >= 70 ? 70 : 30);
        doc.setFont("helvetica", "bold");
        doc.text(`${pct}%`, MARGIN + CONTENT_W * 0.75, y + 4);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(100, 100, 100);
        doc.text(new Date(h.timestamp).toLocaleDateString("en-IN", { day: "numeric", month: "short" }), MARGIN + CONTENT_W * 0.85, y + 4);
        y += 7;
      });
      y += 6;

      // ── Assignments ───────────────────────────────────────
      if (preview.assignments_completed?.length > 0) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.setTextColor(15, 15, 15);
        doc.text("Completed Assignments", MARGIN, y);
        y += 7;
        preview.assignments_completed.forEach((a) => {
          if (y > 270) { doc.addPage(); y = 20; }
          const pct = Math.round((a.score / a.total_questions) * 100);
          doc.setFont("helvetica", "normal");
          doc.setFontSize(9);
          doc.setTextColor(30, 30, 30);
          doc.text(`• ${a.title} — ${pct}% (${a.score}/${a.total_questions})`, MARGIN + 2, y);
          y += 6;
        });
        y += 4;
      }

      // ── Footer ────────────────────────────────────────────
      const pageCount = doc.getNumberOfPages();
      for (let p = 1; p <= pageCount; p++) {
        doc.setPage(p);
        doc.setFontSize(8);
        doc.setTextColor(160, 160, 160);
        doc.text(`AI Sakhi · Page ${p} of ${pageCount}`, PAGE_W / 2, 290, { align: "center" });
      }

      doc.save(`Sakhi-Report-${preview.user.name.replace(/\s+/g, "-")}-${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (e) {
      console.error(e);
      alert("PDF generation failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main-content" style={{ overflowY: "auto", padding: "28px 32px" }}>
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          <div style={{ marginBottom: 24 }}>
            <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.4px", marginBottom: 4 }}>
              Export Report 📄
            </h1>
            <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
              Download a professional PDF progress report for yourself or to share with a teacher or parent.
            </p>
          </div>

          {!preview ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card"
              style={{ padding: "56px 24px", textAlign: "center" }}>
              <div style={{ fontSize: 56, marginBottom: 16 }}>📊</div>
              <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Generate Your Progress Report</h2>
              <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 24, maxWidth: 400, margin: "0 auto 24px" }}>
                Your report includes quiz history, assignments, flashcard stats, and personalised insights.
              </p>
              {error && <p style={{ color: "#dc2626", fontSize: 13, marginBottom: 12 }}>{error}</p>}
              <button className="btn btn-primary" onClick={() => void fetchReport()} disabled={loading}>
                <FileText size={14} />
                {loading ? "Loading data…" : "Load My Report"}
              </button>
            </motion.div>
          ) : (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              {/* Preview card */}
              <div className="card" style={{ padding: "24px 28px", marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 800 }}>{preview.user.name}</div>
                    <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>Class {preview.user.class_}</div>
                  </div>
                  <button className="btn btn-primary" onClick={() => void downloadPdf()} disabled={loading}>
                    <Download size={14} />
                    {loading ? "Generating PDF…" : "Download PDF"}
                  </button>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 20 }}>
                  {[
                    { label: "Streak",   value: `${preview.streak}🔥`, icon: Flame },
                    { label: "Avg Score", value: preview.avg_quiz_pct != null ? `${preview.avg_quiz_pct}%` : "–", icon: BarChart2 },
                    { label: "Quizzes",   value: preview.total_quizzes, icon: Trophy },
                    { label: "Flashcards", value: preview.flashcard_stats?.total ?? 0, icon: FileText },
                  ].map(({ label, value, icon: Icon }) => (
                    <div key={label} style={{ background: "#f0fdf4", borderRadius: 12, padding: "12px 14px" }}>
                      <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>{label}</div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: "var(--emerald)" }}>{value}</div>
                    </div>
                  ))}
                </div>

                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Recent Quiz History</div>
                  {preview.quiz_history.slice(0, 6).map((h, i) => {
                    const pct = h.total ? Math.round((h.score / h.total) * 100) : 0;
                    return (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
                        <span style={{ flex: 1, fontSize: 13 }}>{h.topic}</span>
                        <div style={{ width: 100 }}>
                          <div className="progress-track" style={{ height: 5 }}>
                            <div className="progress-fill" style={{ width: `${pct}%`, background: pct >= 70 ? "var(--emerald)" : pct >= 40 ? "#f59e0b" : "#ef4444" }} />
                          </div>
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 700, width: 32, textAlign: "right", color: pct >= 70 ? "var(--emerald)" : "#f59e0b" }}>{pct}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text-muted)" }}>
                <AlertCircle size={13} />
                Report generated at {new Date(preview.generated_at).toLocaleTimeString("en-IN")}. Click "Download PDF" for the full formatted report.
              </div>
            </motion.div>
          )}
        </div>
      </main>
    </div>
  );
}
