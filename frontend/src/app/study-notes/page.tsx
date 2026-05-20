"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Sidebar from "@/components/Sidebar";
import { api } from "@/lib/api";
import { useUser } from "@/lib/user-context";
import { getSubjectsForClass, getTopicsForSubjectAndClass } from "@/lib/curriculum";
import { FileText, Download, Sparkles, Save, CheckCircle, RefreshCw, AlertCircle } from "lucide-react";

type SavedNote = { topic: string; notes_md: string; savedAt: string };
const STORAGE_KEY = "sakhi_study_notes";

function saveNote(note: SavedNote) {
  try {
    const existing: SavedNote[] = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    const filtered = existing.filter((n) => n.topic !== note.topic);
    localStorage.setItem(STORAGE_KEY, JSON.stringify([note, ...filtered].slice(0, 10)));
  } catch {}
}

function loadSavedNotes(): SavedNote[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); } catch { return []; }
}

// Markdown renderer — supports headings, bullets, bold inline text
function renderMd(md: string): React.ReactNode[] {
  return md.split("\n").map((line, i) => {
    if (line.startsWith("# "))   return <h1 key={i} style={{ fontSize: 22, fontWeight: 800, margin: "16px 0 8px", color: "var(--text-primary)" }}>{renderInline(line.slice(2))}</h1>;
    if (line.startsWith("## "))  return <h2 key={i} style={{ fontSize: 16, fontWeight: 700, margin: "14px 0 6px", color: "var(--emerald-dark, #065f46)" }}>{renderInline(line.slice(3))}</h2>;
    if (line.startsWith("### ")) return <h3 key={i} style={{ fontSize: 14, fontWeight: 700, margin: "10px 0 4px" }}>{renderInline(line.slice(4))}</h3>;
    if (line.startsWith("- ") || line.startsWith("* ")) return (
      <li key={i} style={{ fontSize: 14, lineHeight: 1.7, marginLeft: 20, color: "var(--text-secondary)" }}>
        {renderInline(line.slice(2))}
      </li>
    );
    if (line.trim() === "") return <div key={i} style={{ height: 6 }} />;
    return <p key={i} style={{ fontSize: 14, lineHeight: 1.75, color: "var(--text-secondary)", margin: "4px 0" }}>{renderInline(line)}</p>;
  });
}

// Render bold (**text**) inline
function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*.+?\*\*)/);
  return <>{parts.map((p, i) =>
    p.startsWith("**") && p.endsWith("**")
      ? <strong key={i} style={{ color: "var(--text-primary)" }}>{p.slice(2, -2)}</strong>
      : p
  )}</>;
}

export default function StudyNotesPage() {
  const { user } = useUser();
  const [subjects] = useState(() => user ? getSubjectsForClass(user.class_) : []);
  const [selectedSub, setSelectedSub] = useState(() => (subjects[0] as { id: string })?.id || "");
  const [topics, setTopics] = useState<string[]>(() => user && subjects[0] ? getTopicsForSubjectAndClass((subjects[0] as { id: string }).id, user.class_) : []);
  const [topic, setTopic] = useState(() => topics[0] || "");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<string>("");
  const [noteTopic, setNoteTopic] = useState("");
  const [saved, setSaved] = useState(false);
  const [savedNotes, setSavedNotes] = useState<SavedNote[]>([]);
  const [activeTab, setActiveTab] = useState<"generate" | "saved">("generate");

  useEffect(() => {
    setSavedNotes(loadSavedNotes());
  }, []);

  useEffect(() => {
    const t = getTopicsForSubjectAndClass(selectedSub, user?.class_ || "8");
    setTopics(t);
    setTopic(t[0] || "");
  }, [selectedSub, user?.class_]);

  const handleGenerate = async () => {
    if (!topic.trim() || !user) return;
    setGenerating(true);
    setNotes("");
    setError(null);
    setSaved(false);
    try {
      const subject = subjects.find((s) => (s as { id: string }).id === selectedSub);
      const data = await api.generateStudyNotes({
        topic,
        class_: user.class_,
        language: user.language,
        subject: (subject as { label?: string })?.label || "",
        user_id: user.user_id,
      }) as { notes_md?: string };
      setNotes(data.notes_md || "");
      setNoteTopic(topic);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error generating notes. Please try again.");
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = () => {
    if (!notes || !noteTopic) return;
    const note = { topic: noteTopic, notes_md: notes, savedAt: new Date().toISOString() };
    saveNote(note);
    setSavedNotes(loadSavedNotes());
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleDownload = () => {
    if (!notes) return;
    const blob = new Blob([notes], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${noteTopic.replace(/\s+/g, "-")}-notes.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main-content" style={{ overflowY: "auto", padding: "28px 32px" }}>
        <div style={{ maxWidth: 820, margin: "0 auto" }}>
          <div style={{ marginBottom: 24 }}>
            <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.4px", marginBottom: 4 }}>
              AI Study Notes 📝
            </h1>
            <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
              Generate structured notes for any topic — instantly, with examples and review questions.
            </p>
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", gap: 4, marginBottom: 20, background: "#f3f4f6", borderRadius: 10, padding: 4, width: "fit-content" }}>
            {(["generate", "saved"] as const).map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                style={{ padding: "6px 16px", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 600, fontSize: 13,
                  background: activeTab === tab ? "white" : "transparent",
                  color: activeTab === tab ? "var(--text-primary)" : "var(--text-muted)",
                  boxShadow: activeTab === tab ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
                  fontFamily: "Inter, sans-serif",
                }}>
                {tab === "generate" ? "✨ Generate" : `📚 Saved (${savedNotes.length})`}
              </button>
            ))}
          </div>

          {activeTab === "generate" ? (
            <>
              {/* Controls */}
              <div className="card" style={{ padding: "20px 24px", marginBottom: 20 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 14 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>Subject</label>
                    <select className="input input-select" value={selectedSub} onChange={(e) => setSelectedSub(e.target.value)}>
                      {subjects.map((s) => <option key={(s as { id: string }).id} value={(s as { id: string }).id}>{(s as { label?: string }).label || (s as { id: string }).id}</option>)}
                    </select>
                  </div>
                  <div style={{ gridColumn: "2/-1" }}>
                    <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>Topic</label>
                    <select className="input input-select" value={topic} onChange={(e) => setTopic(e.target.value)}>
                      {topics.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </div>
                <button className="btn btn-primary" onClick={() => void handleGenerate()} disabled={generating || !topic}>
                  <Sparkles size={14} />
                  {generating ? "Generating notes…" : "Generate Study Notes"}
                </button>
              </div>

              {/* Notes display */}
              <AnimatePresence>
                {generating && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card"
                    style={{ padding: "48px 24px", textAlign: "center" }}>
                    <div style={{ fontSize: 32, marginBottom: 12 }}>✨</div>
                    <div style={{ fontSize: 14, color: "var(--text-secondary)" }}>Sakhi is writing your notes…</div>
                  </motion.div>
                )}
                {!generating && error && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card"
                    style={{ padding: "32px 24px", textAlign: "center", border: "1.5px solid #fecaca", background: "#fef2f2" }}>
                    <AlertCircle size={28} style={{ color: "#dc2626", marginBottom: 12 }} />
                    <p style={{ fontSize: 14, color: "#991b1b", marginBottom: 16 }}>{error}</p>
                    <button className="btn btn-primary btn-sm" onClick={() => void handleGenerate()}>
                      <RefreshCw size={13} /> Retry
                    </button>
                  </motion.div>
                )}
                {!generating && notes && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="card"
                    style={{ padding: "24px 28px" }}>
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginBottom: 16 }}>
                      <button className="btn btn-secondary btn-sm" onClick={handleSave} disabled={saved}>
                        {saved ? <><CheckCircle size={13} /> Saved!</> : <><Save size={13} /> Save</>}
                      </button>
                      <button className="btn btn-secondary btn-sm" onClick={handleDownload}>
                        <Download size={13} /> Download .md
                      </button>
                    </div>
                    <div>{renderMd(notes)}</div>
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          ) : (
            /* Saved notes */
            savedNotes.length === 0 ? (
              <div className="card" style={{ textAlign: "center", padding: "56px 24px" }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📚</div>
                <p style={{ color: "var(--text-secondary)" }}>No saved notes yet. Generate some!</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {savedNotes.map((n) => (
                  <motion.div key={n.topic} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card"
                    style={{ padding: "16px 20px", cursor: "pointer" }}
                    onClick={() => { setNotes(n.notes_md); setNoteTopic(n.topic); setActiveTab("generate"); }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <FileText size={14} style={{ color: "var(--emerald)" }} />
                        <span style={{ fontWeight: 600, fontSize: 14 }}>{n.topic}</span>
                      </div>
                      <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                        {new Date(n.savedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>
            )
          )}
        </div>
      </main>
    </div>
  );
}
