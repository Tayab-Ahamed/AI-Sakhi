"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import confetti from "canvas-confetti";

import Sidebar from "@/components/Sidebar";
import { api } from "@/lib/api";
import { getSubjectsForClass, getTopicsForSubjectAndClass } from "@/lib/curriculum";
import { useUser } from "@/lib/user-context";
import { saveQuizToOfflineCache, getOfflineCachedQuiz, usePwa } from "@/lib/use-pwa";
import { Zap, Lightbulb, CheckCircle, XCircle, RotateCcw, MessageCircle, ChevronRight, ChevronLeft } from "lucide-react";

type Question = { id: number; question: string; options: Record<string, string>; correct: string; hint: string; explanation: string };
type Result = { is_correct: boolean; feedback: string; correct_answer: string };

type Difficulty = "easy" | "medium" | "hard";
const DIFFICULTIES: { id: Difficulty; label: string; emoji: string; desc: string }[] = [
  { id: "easy",   label: "Easy",   emoji: "🌱", desc: "Basic recall" },
  { id: "medium", label: "Medium", emoji: "🔥", desc: "Application" },
  { id: "hard",   label: "Hard",   emoji: "⚡", desc: "Analysis & reasoning" },
];

function QuizPageContent() {
  const { user } = useUser();
  const searchParams = useSearchParams();
  const topicFromUrl = searchParams.get("topic") || "";
  const [subjects] = useState<ReturnType<typeof getSubjectsForClass>>(() => (
    user ? getSubjectsForClass(user.class_) : []
  ));
  const [selectedSub, setSelectedSub] = useState(() => (subjects[0]?.id || ""));
  const [topics, setTopics] = useState<string[]>(() => (
    user && subjects[0] ? getTopicsForSubjectAndClass(subjects[0].id, user.class_) : []
  ));
  const [topic, setTopic] = useState(() => topicFromUrl || user?.weak_subject || "");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [diffRecommendation, setDiffRecommendation] = useState<{ recommended: string; average_pct: number | null; data_points: number } | null>(null);
  const [diffOverridden, setDiffOverridden] = useState(false);
  const diffFetchRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [phase, setPhase] = useState<"setup" | "active" | "done">("setup");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [quizTopic, setQuizTopic] = useState("");
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [hints, setHints] = useState<Record<number, boolean>>({});
  const [results, setResults] = useState<Record<number, Result>>({});
  const [loading, setLoading] = useState(false);
  const { isOnline } = usePwa();

  // ── Adaptive difficulty: auto-fetch when topic changes ──────────────
  useEffect(() => {
    if (!user?.user_id || !topic.trim()) {
      setDiffRecommendation(null);
      return;
    }
    // Debounce by 600ms so we don't fire on every keystroke
    if (diffFetchRef.current) clearTimeout(diffFetchRef.current);
    diffFetchRef.current = setTimeout(async () => {
      try {
        const ctx = await api.getRecommendedDifficulty(user.user_id, topic.trim());
        setDiffRecommendation(ctx);
        if (!diffOverridden) {
          setDifficulty(ctx.recommended as Difficulty);
        }
      } catch {
        setDiffRecommendation(null);
      }
    }, 600);
    return () => {
      if (diffFetchRef.current) clearTimeout(diffFetchRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topic, user?.user_id]);

  const onSubjectChange = (sid: string) => {
    setSelectedSub(sid);
    if (user) setTopics(getTopicsForSubjectAndClass(sid, user.class_));
    setTopic("");
    setDiffRecommendation(null);
    setDiffOverridden(false);
  };

  const generate = async () => {
    if (!topic.trim() || !user) return;
    setLoading(true);
    try {
      const res = await api.generateQuiz({ topic: topic.trim(), class_: user.class_, language: user.language, user_id: user.user_id, difficulty });
      setQuestions(res.questions || []);
      setQuizTopic(res.topic || topic);
      // Save to offline cache so students can practice without internet
      saveQuizToOfflineCache({
        topic: topic.trim(), difficulty,
        class_: user.class_, language: user.language,
        questions: res.questions || [],
        cachedAt: new Date().toISOString(),
      });
      setCurrentQ(0); setAnswers({}); setHints({}); setResults({});
      setPhase("active");
    } catch {
      // Offline fallback: use cached quiz if available
      const cached = getOfflineCachedQuiz(topic.trim(), difficulty);
      if (cached && cached.questions.length > 0) {
        setQuestions(cached.questions as Question[]);
        setQuizTopic(cached.topic);
        setCurrentQ(0); setAnswers({}); setHints({}); setResults({});
        setPhase("active");
      } else {
        alert(isOnline
          ? "Error generating quiz. Is the backend running?"
          : "You're offline and no cached quiz is available for this topic yet. Try another topic.");
      }
    } finally {
      setLoading(false);
    }
  };

  const submitAll = async () => {
    if (!questions.length) return;
    setLoading(true);
    const res: Record<number, Result> = {};
    let score = 0;
    for (const q of questions) {
      const r = await api.evaluateAnswer({ question: q, user_answer: answers[q.id] || "A", language: user?.language, user_id: user?.user_id });
      res[q.id] = r;
      if (r.is_correct) score++;
    }
    setResults(res);
    if (user?.user_id) {
      await api.updateProgress({ user_id: user.user_id, topic: quizTopic, score, total: questions.length });
    }
    setPhase("done");
    setLoading(false);

    // 🎉 Confetti on perfect score
    if (score === questions.length && questions.length > 0) {
      const end = Date.now() + 2500;
      const fire = () => {
        confetti({ particleCount: 80, angle: 60, spread: 55, origin: { x: 0 }, colors: ["#059669", "#34d399", "#fbbf24"] });
        confetti({ particleCount: 80, angle: 120, spread: 55, origin: { x: 1 }, colors: ["#059669", "#34d399", "#fbbf24"] });
        if (Date.now() < end) requestAnimationFrame(fire);
      };
      fire();
    }
  };

  const score = Object.values(results).filter((r) => r.is_correct).length;
  const pct = questions.length ? Math.round((score / questions.length) * 100) : 0;
  const isPerfect = score === questions.length && questions.length > 0;

  const encouragement =
    isPerfect        ? "🎉 PERFECT! You've totally mastered this topic!" :
    pct >= 80        ? "Excellent work! Almost flawless. 🎉" :
    pct >= 60        ? "Good effort! Keep practicing. 💪" :
    pct >= 40        ? "You're learning. Try once more! 🌸" :
    "Every attempt teaches you something. Keep going! 🌸";

  const saveQuizResult = async () => {
    if (!user || phase !== "done") return;
    try {
      await api.saveArtifact({
        user_id: user.user_id,
        artifact_type: "quiz_result",
        title: `${quizTopic} quiz result`,
        topic: quizTopic,
        payload: {
          topic: quizTopic,
          difficulty,
          score,
          total: questions.length,
          percentage: pct,
          results,
        },
      });
      alert("Quiz result saved to your library.");
    } catch {
      alert("Could not save this quiz result right now.");
    }
  };

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main-content" style={{ overflowY: "auto" }}>
        <div style={{ maxWidth: 640, margin: "0 auto", padding: "32px 24px" }}>
          <div style={{ marginBottom: 28 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: "#fefce8", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Zap size={18} style={{ color: "#ca8a04" }} />
              </div>
              <div>
                <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.3px" }}>Quiz Mode</h1>
                <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>Test your knowledge with AI-generated questions</p>
              </div>
            </div>
          </div>

          <AnimatePresence mode="wait">
            {phase === "setup" && (
              <motion.div key="setup" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <div className="card" style={{ padding: 28 }}>
                  {/* Subject */}
                  <div style={{ marginBottom: 20 }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>Subject</p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {subjects.map((s) => (
                        <button key={s.id} className={`subject-chip ${selectedSub === s.id ? "selected" : ""}`} onClick={() => onSubjectChange(s.id)} style={{ fontSize: 12, padding: "6px 11px" }}>
                          {s.icon} {s.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Topic */}
                  <div style={{ marginBottom: 20 }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>Topic</p>
                    {topics.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                        {topics.map((t) => (
                          <button key={t} className={`subject-chip ${topic === t ? "selected" : ""}`} onClick={() => setTopic(t)} style={{ fontSize: 12, padding: "5px 10px" }}>{t}</button>
                        ))}
                      </div>
                    )}
                    <input className="input" placeholder="Or type a custom topic..." value={topic} onChange={(e) => setTopic(e.target.value)} onKeyDown={(e) => e.key === "Enter" && generate()} />
                  </div>

                  {/* Difficulty */}
                  <div style={{ marginBottom: 24 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                      <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Difficulty</p>
                      {diffRecommendation && diffRecommendation.data_points > 0 && (
                        <motion.div
                          initial={{ opacity: 0, x: 6 }}
                          animate={{ opacity: 1, x: 0 }}
                          style={{
                            display: "flex", alignItems: "center", gap: 5,
                            padding: "3px 10px", borderRadius: 99,
                            background: "linear-gradient(90deg, #ecfdf5, #d1fae5)",
                            border: "1px solid #6ee7b7", fontSize: 12, fontWeight: 600, color: "#065f46",
                          }}
                        >
                          <span>🧠</span>
                          <span>Sakhi suggests: {diffRecommendation.recommended}</span>
                          {diffOverridden && (
                            <button
                              onClick={() => { setDifficulty(diffRecommendation.recommended as Difficulty); setDiffOverridden(false); }}
                              style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: "#059669", marginLeft: 2, padding: 0, fontWeight: 700 }}
                            >↺ Reset</button>
                          )}
                        </motion.div>
                      )}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                      {DIFFICULTIES.map((d) => (
                        <button
                          key={d.id}
                          onClick={() => { setDifficulty(d.id); setDiffOverridden(d.id !== diffRecommendation?.recommended); }}
                          style={{
                            padding: "10px 8px",
                            borderRadius: "var(--radius-md)",
                            border: `1.5px solid ${difficulty === d.id ? "var(--emerald)" : "var(--border)"}`,
                            background: difficulty === d.id ? "var(--emerald-light)" : "white",
                            cursor: "pointer",
                            transition: "all 0.15s",
                            textAlign: "center",
                            fontFamily: "Inter, sans-serif",
                            position: "relative",
                          }}
                        >
                          {diffRecommendation?.recommended === d.id && diffRecommendation.data_points > 0 && (
                            <div style={{ position: "absolute", top: -6, right: -6, width: 14, height: 14, borderRadius: "50%", background: "var(--emerald)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                              <span style={{ fontSize: 8, color: "white" }}>✓</span>
                            </div>
                          )}
                          <div style={{ fontSize: 20, marginBottom: 4 }}>{d.emoji}</div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: difficulty === d.id ? "var(--emerald-dark)" : "var(--text-primary)" }}>{d.label}</div>
                          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{d.desc}</div>
                        </button>
                      ))}
                    </div>
                    {diffRecommendation && diffRecommendation.data_points > 0 && (
                      <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 7 }}>
                        Based on your last {diffRecommendation.data_points} quiz{diffRecommendation.data_points !== 1 ? "zes" : ""}
                        {diffRecommendation.average_pct !== null ? ` (avg ${diffRecommendation.average_pct}%)` : ""}.
                        You can always override this.
                      </p>
                    )}
                  </div>

                  <button className="btn btn-primary btn-full" onClick={generate} disabled={!topic.trim() || loading} style={{ padding: "12px", justifyContent: "center" }}>
                    {loading ? <><div style={{ width: 15, height: 15, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "white", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} /> Generating...</> : <><Zap size={15} /> Generate 5 Questions</>}
                  </button>
                </div>
              </motion.div>
            )}

            {phase === "active" && questions.length > 0 && (
              <motion.div key="active" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <div style={{ marginBottom: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                    <span className="badge badge-emerald">{quizTopic}</span>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <span className={`badge badge-${difficulty === "easy" ? "teal" : difficulty === "hard" ? "amber" : "gray"}`}>
                        {DIFFICULTIES.find(d => d.id === difficulty)?.emoji} {difficulty}
                      </span>
                      <span style={{ fontSize: 13, color: "var(--text-secondary)", fontWeight: 500 }}>{currentQ + 1} / {questions.length}</span>
                    </div>
                  </div>
                  <div className="progress-track">
                    <div className="progress-fill" style={{ width: `${((currentQ + 1) / questions.length) * 100}%` }} />
                  </div>
                </div>

                {questions.map((q, idx) => (
                  <div key={q.id} style={{ display: idx === currentQ ? "block" : "none" }}>
                    <div className="card" style={{ padding: 24 }}>
                      <p style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.5, marginBottom: 20 }}>{q.question}</p>
                      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
                        {Object.entries(q.options).map(([key, val]) => (
                          <button key={key} className={`quiz-option ${answers[q.id] === key ? "selected" : ""}`} onClick={() => setAnswers((a) => ({ ...a, [q.id]: key }))}>
                            <span className="quiz-option-key">{key}</span>
                            <span style={{ fontSize: 14, color: "var(--text-primary)" }}>{val}</span>
                          </button>
                        ))}
                      </div>

                      {!hints[q.id] ? (
                        <button className="btn btn-ghost btn-sm" onClick={() => setHints((h) => ({ ...h, [q.id]: true }))} style={{ color: "var(--text-muted)", fontSize: 13 }}>
                          <Lightbulb size={13} /> Need a hint?
                        </button>
                      ) : (
                        <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} style={{ padding: "10px 14px", background: "#fefce8", border: "1px solid #fde68a", borderRadius: "var(--radius-md)", fontSize: 13, color: "#92400e", display: "flex", gap: 8, alignItems: "flex-start" }}>
                          <Lightbulb size={14} style={{ color: "#ca8a04", flexShrink: 0, marginTop: 1 }} />
                          {q.hint}
                        </motion.div>
                      )}

                      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 24, paddingTop: 20, borderTop: "1px solid var(--border-subtle)" }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => setCurrentQ((c) => Math.max(0, c - 1))} disabled={currentQ === 0}>
                          <ChevronLeft size={14} /> Previous
                        </button>
                        {currentQ < questions.length - 1 ? (
                          <button className="btn btn-primary btn-sm" onClick={() => setCurrentQ((c) => c + 1)} disabled={!answers[q.id]}>
                            Next <ChevronRight size={14} />
                          </button>
                        ) : (
                          <button className="btn btn-primary btn-sm" onClick={submitAll} disabled={Object.keys(answers).length < questions.length || loading}>
                            {loading ? "Checking..." : "Submit ✓"}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </motion.div>
            )}

            {phase === "done" && (
              <motion.div key="done" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div className="card" style={{ padding: 28, textAlign: "center", border: isPerfect ? "2px solid #22c55e" : undefined, background: isPerfect ? "#f0fdf4" : undefined }}>
                  {isPerfect && <div style={{ fontSize: 48, marginBottom: 8 }}>🎉</div>}
                  <div style={{ fontSize: 52, fontWeight: 800, letterSpacing: "-2px", color: isPerfect ? "#16a34a" : "var(--emerald)", marginBottom: 4 }}>
                    {score}<span style={{ fontSize: 28, color: "var(--text-muted)", fontWeight: 400 }}>/{questions.length}</span>
                  </div>
                  <div className="progress-track" style={{ margin: "12px auto 16px", maxWidth: 200 }}>
                    <div className="progress-fill" style={{ width: `${pct}%` }} />
                  </div>
                  <p style={{ fontSize: 15, color: "var(--text-primary)", fontWeight: 500 }}>{encouragement}</p>
                  {isPerfect && (
                    <div style={{ marginTop: 12, fontSize: 13, color: "var(--emerald)", fontWeight: 600 }}>+{questions.length * 50} XP earned! 🌟</div>
                  )}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {questions.map((q) => {
                    const r = results[q.id];
                    return (
                      <div key={q.id} className="card" style={{ padding: "14px 18px", borderLeft: `3px solid ${r?.is_correct ? "#22c55e" : "#f87171"}`, borderRadius: "var(--radius-lg)" }}>
                        <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                          {r?.is_correct ? <CheckCircle size={16} style={{ color: "#22c55e", flexShrink: 0, marginTop: 1 }} /> : <XCircle size={16} style={{ color: "#f87171", flexShrink: 0, marginTop: 1 }} />}
                          <div>
                            <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 3 }}>{q.question}</p>
                            <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>{r?.feedback}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                  <button className="btn btn-secondary" style={{ flex: 1, justifyContent: "center" }} onClick={() => { setPhase("setup"); setQuestions([]); }}>
                    <RotateCcw size={14} /> Try Again
                  </button>
                  <button className="btn btn-secondary" style={{ flex: 1, justifyContent: "center" }} onClick={saveQuizResult}>
                    Save Result
                  </button>
                  <Link href="/chat" className="btn btn-primary" style={{ flex: 1, justifyContent: "center" }}>
                    <MessageCircle size={14} /> Ask Sakhi
                  </Link>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

export default function QuizPage() {
  return (
    <Suspense fallback={null}>
      <QuizPageContent />
    </Suspense>
  );
}
