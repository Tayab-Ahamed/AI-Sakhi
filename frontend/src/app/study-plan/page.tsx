"use client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import { api } from "@/lib/api";
import { getSubjectsForClass, getTopicsForSubjectAndClass } from "@/lib/curriculum";
import { useUser } from "@/lib/user-context";
import { BookOpen, Clock, CheckCircle, HelpCircle, Target, Star } from "lucide-react";

type Section =
  | { time: string; title: string; content: string; example?: string }
  | { time: string; title: string; questions: string[] }
  | { time: string; title: string; key_points: string[] };

type StudyPlan = {
  topic: string;
  subject: string;
  class: string;
  language: string;
  duration_minutes: number;
  goal: string;
  sections: Section[];
  motivation: string;
};

function SectionCard({ section, index }: { section: Section; index: number }) {
  const colors = [
    { bg: "#f0fdf4", border: "#bbf7d0", accent: "#059669", dot: "#34d399" },
    { bg: "#eff6ff", border: "#bfdbfe", accent: "#2563eb", dot: "#60a5fa" },
    { bg: "#fefce8", border: "#fde68a", accent: "#ca8a04", dot: "#fbbf24" },
  ];
  const c = colors[index % colors.length];

  const hasQuestions = "questions" in section;
  const hasKeyPoints = "key_points" in section;
  const hasContent = "content" in section;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 * index }}
      style={{
        background: c.bg,
        border: `1px solid ${c.border}`,
        borderRadius: "var(--radius-xl)",
        padding: "20px 22px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: c.accent, display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: 12, fontWeight: 700 }}>
          {index + 1}
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>{section.title}</div>
          <div style={{ fontSize: 12, color: c.accent, fontWeight: 600 }}>
            <Clock size={10} style={{ display: "inline", marginRight: 3 }} />
            {section.time}
          </div>
        </div>
      </div>

      {hasContent && (
        <div>
          <p style={{ fontSize: 13, color: "var(--text-primary)", lineHeight: 1.7, marginBottom: 8 }}>
            {(section as { content: string }).content}
          </p>
          {(section as { example?: string }).example && (
            <div style={{ display: "flex", gap: 8, padding: "10px 12px", background: "white", borderRadius: "var(--radius-md)", border: `1px solid ${c.border}` }}>
              <span style={{ fontSize: 14 }}>💡</span>
              <p style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.6 }}>
                <strong>Example:</strong> {(section as { example: string }).example}
              </p>
            </div>
          )}
        </div>
      )}

      {hasQuestions && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {(section as { questions: string[] }).questions.map((q, qi) => (
            <div key={qi} style={{ display: "flex", gap: 10, padding: "10px 12px", background: "white", borderRadius: "var(--radius-md)", border: `1px solid ${c.border}` }}>
              <HelpCircle size={14} style={{ color: c.accent, flexShrink: 0, marginTop: 2 }} />
              <span style={{ fontSize: 13, color: "var(--text-primary)", lineHeight: 1.5 }}>{q}</span>
            </div>
          ))}
        </div>
      )}

      {hasKeyPoints && (
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          {(section as { key_points: string[] }).key_points.map((kp, ki) => (
            <div key={ki} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
              <CheckCircle size={14} style={{ color: c.accent, flexShrink: 0, marginTop: 2 }} />
              <span style={{ fontSize: 13, color: "var(--text-primary)", lineHeight: 1.5 }}>{kp}</span>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

function StudyPlanPageContent() {
  const { user } = useUser();
  const searchParams = useSearchParams();
  const urlTopic = searchParams.get("topic") || "";
  const [subjects] = useState<ReturnType<typeof getSubjectsForClass>>(() => (
    user ? getSubjectsForClass(user.class_) : []
  ));
  const [selectedSub, setSelectedSub] = useState(() => (subjects[0]?.id || ""));
  const [topics, setTopics] = useState<string[]>(() => (
    user && subjects[0] ? getTopicsForSubjectAndClass(subjects[0].id, user.class_) : []
  ));
  const [topic, setTopic] = useState(() => urlTopic || user?.weak_subject || "");
  const [plan, setPlan] = useState<StudyPlan | null>(null);
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    if (!topic.trim() || !user) return;
    setLoading(true);
    setPlan(null);
    try {
      const sub = subjects.find((s) => s.id === selectedSub);
      const res = await api.generateStudyPlan({
        topic: topic.trim(),
        subject: sub?.label || selectedSub,
        class_: user.class_,
        language: user.language,
        user_id: user.user_id,
      });
      // The plan object is returned directly from the backend
      const planData = res.study_plan || res.plan || res;
      setPlan(typeof planData === "string" ? JSON.parse(planData) : planData);
    } catch {
      alert("Error generating study plan. Is the backend running?");
    } finally {
      setLoading(false);
    }
  };

  const savePlan = async () => {
    if (!user || !plan) return;
    try {
      await api.saveArtifact({
        user_id: user.user_id,
        artifact_type: "study_plan",
        title: `${plan.topic} study plan`,
        topic: plan.topic,
        payload: plan as unknown as object,
      });
      alert("Study plan saved to your library.");
    } catch {
      alert("Could not save this study plan right now.");
    }
  };

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main-content" style={{ overflowY: "auto" }}>
        <div style={{ maxWidth: 660, margin: "0 auto", padding: "32px 24px" }}>
          <div style={{ marginBottom: 28 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <BookOpen size={18} style={{ color: "#2563eb" }} />
              </div>
              <div>
                <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.3px" }}>Study Plan</h1>
                <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>A structured 20-minute session, tailored for you</p>
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: 28, marginBottom: 16 }}>
            <div style={{ marginBottom: 18 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Subject</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {subjects.map((s) => (
                  <button
                    key={s.id}
                    className={`subject-chip ${selectedSub === s.id ? "selected" : ""}`}
                    onClick={() => {
                      setSelectedSub(s.id);
                      if (user) setTopics(getTopicsForSubjectAndClass(s.id, user.class_));
                    }}
                    style={{ fontSize: 12, padding: "6px 11px" }}
                  >
                    {s.icon} {s.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 22 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Topic</p>
              {topics.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                  {topics.map((t) => (
                    <button key={t} className={`subject-chip ${topic === t ? "selected" : ""}`} onClick={() => setTopic(t)} style={{ fontSize: 12, padding: "5px 10px" }}>
                      {t}
                    </button>
                  ))}
                </div>
              )}
              <input className="input" placeholder="Or type a custom topic..." value={topic} onChange={(e) => setTopic(e.target.value)} onKeyDown={(e) => e.key === "Enter" && generate()} />
            </div>

            <button className="btn btn-primary btn-full" onClick={generate} disabled={!topic.trim() || loading} style={{ padding: "12px", justifyContent: "center" }}>
              {loading
                ? <><div style={{ width: 15, height: 15, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "white", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} /> Generating plan...</>
                : <><Clock size={15} /> Create 20-min Plan</>}
            </button>
          </div>

          <AnimatePresence>
            {plan && (
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} style={{ display: "flex", flexDirection: "column", gap: 12 }}>

                {/* Goal banner */}
                <div style={{ background: "linear-gradient(135deg, #065f46 0%, #0d9488 100%)", borderRadius: "var(--radius-xl)", padding: "20px 24px", color: "white" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <Target size={16} style={{ opacity: 0.8 }} />
                    <span style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", opacity: 0.75 }}>Today&apos;s Goal</span>
                  </div>
                  <p style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.5 }}>{plan.goal}</p>
                  <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                    <span style={{ fontSize: 12, background: "rgba(255,255,255,0.15)", padding: "3px 10px", borderRadius: 20 }}>
                      📚 {plan.subject}
                    </span>
                    <span style={{ fontSize: 12, background: "rgba(255,255,255,0.15)", padding: "3px 10px", borderRadius: 20 }}>
                      🕐 {plan.duration_minutes} min
                    </span>
                    <span style={{ fontSize: 12, background: "rgba(255,255,255,0.15)", padding: "3px 10px", borderRadius: 20 }}>
                      Class {plan.class}
                    </span>
                  </div>
                </div>

                {/* Sections */}
                {plan.sections?.map((section, i) => (
                  <SectionCard key={i} section={section} index={i} />
                ))}

                {/* Motivation */}
                {plan.motivation && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    style={{ background: "#fefce8", border: "1px solid #fde68a", borderRadius: "var(--radius-xl)", padding: "18px 22px", display: "flex", gap: 12, alignItems: "flex-start" }}
                  >
                    <Star size={18} style={{ color: "#ca8a04", flexShrink: 0, marginTop: 1 }} />
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#92400e", marginBottom: 4 }}>Sakhi&apos;s Message</div>
                      <p style={{ fontSize: 13, color: "#78350f", lineHeight: 1.6 }}>{plan.motivation}</p>
                    </div>
                  </motion.div>
                )}

                {/* Actions */}
                <div style={{ display: "flex", gap: 10 }}>
                  <button className="btn btn-secondary" style={{ flex: 1, justifyContent: "center" }} onClick={() => setPlan(null)}>
                    New Plan
                  </button>
                  <button className="btn btn-secondary" style={{ flex: 1, justifyContent: "center" }} onClick={savePlan}>
                    Save Plan
                  </button>
                  <Link
                    href={`/quiz?topic=${encodeURIComponent(plan.topic)}`}
                    className="btn btn-secondary"
                    style={{ flex: 1, justifyContent: "center", textDecoration: "none" }}
                  >
                    Quiz on This Topic
                  </Link>
                  <a
                    href={`/focus-timer?topic=${encodeURIComponent(plan.topic)}`}
                    className="btn btn-primary"
                    style={{ flex: 1, justifyContent: "center", textDecoration: "none" }}
                  >
                    <Clock size={14} /> Start Timer
                  </a>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

export default function StudyPlanPage() {
  return (
    <Suspense fallback={null}>
      <StudyPlanPageContent />
    </Suspense>
  );
}
