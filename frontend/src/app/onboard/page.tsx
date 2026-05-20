"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { getLevels, getSubjectsForClass } from "@/lib/curriculum";
import { useUser } from "@/lib/user-context";
import { ArrowRight, Check } from "lucide-react";

const LANGUAGES = [
  { id: "English", label: "English", sub: "Default for most subjects" },
  { id: "Hinglish", label: "Hinglish", sub: "Mix of Hindi and English" },
  { id: "Hindi", label: "हिन्दी", sub: "Pure Hindi responses" },
  { id: "Kannada", label: "ಕನ್ನಡ", sub: "Kannada responses" },
  { id: "Tamil", label: "தமிழ்", sub: "Tamil responses" },
];

const ROLES = [
  { id: "student", label: "Student", sub: "Personal learning companion" },
  { id: "parent", label: "Parent", sub: "Track progress and support learning" },
  { id: "teacher", label: "Teacher", sub: "Monitor and guide many learners" },
  { id: "admin", label: "Admin", sub: "See platform-wide analytics" },
];

const STEPS = ["Hello", "Your Class", "Weak Subject", "Language", "Role"];

export default function OnboardPage() {
  const router = useRouter();
  const { setUser } = useUser();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({ name: "", class_: "9", language: "English", weak_subject: "", role: "student" });
  const [loading, setLoading] = useState(false);
  const [dir, setDir] = useState(1);

  const levels = getLevels();
  const subjects = getSubjectsForClass(form.class_);

  const go = (n: number) => {
    setDir(n);
    setStep((s) => s + n);
  };

  const submit = async () => {
    setLoading(true);
    try {
      const res = await api.createUser(form) as { user_id: number; auth?: any } & Record<string, unknown>;
      setUser({ ...res, ...form } as any, res.auth || null);
      router.push("/chat");
    } catch {
      alert("Cannot reach backend. Make sure FastAPI is running on port 8000.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg-app)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px 16px",
      }}
    >
      <div style={{ width: "100%", maxWidth: 480 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <span style={{ fontSize: 36 }}>🌸</span>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginTop: 8, letterSpacing: "-0.3px" }}>AI Sakhi</h1>
          <p style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 4 }}>
            Patient explanations. Everyday progress.
          </p>
        </div>

        <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 28 }}>
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`onboard-step-dot ${i === step ? "active" : i < step ? "done" : ""}`}
            />
          ))}
        </div>

        <div className="card" style={{ padding: 32, overflow: "hidden" }}>
          <AnimatePresence custom={dir} mode="wait">
            <motion.div
              key={step}
              custom={dir}
              initial={{ x: dir > 0 ? 30 : -30, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: dir > 0 ? -30 : 30, opacity: 0 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
            >
              {step === 0 && (
                <div>
                  <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>What&apos;s your name?</h2>
                  <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 24 }}>
                    Sakhi will use this to personalise your sessions.
                  </p>
                  <input
                    className="input"
                    placeholder="Enter your name"
                    value={form.name}
                    autoFocus
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    onKeyDown={(e) => e.key === "Enter" && form.name.trim() && go(1)}
                    style={{ marginBottom: 0, borderRadius: "var(--radius-lg)", padding: "12px 16px", fontSize: 15 }}
                  />
                </div>
              )}

              {step === 1 && (
                <div>
                  <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>
                    Hi {form.name}! Which class are you in?
                  </h2>
                  <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 20 }}>
                    We&apos;ll tailor the curriculum to your level.
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {levels.map((level) => (
                      <div key={level.id}>
                        <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 6 }}>
                          {level.label}
                        </p>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {level.classes.map((cls) => (
                            <button
                              key={cls}
                              className={`class-btn ${form.class_ === cls ? "selected" : ""}`}
                              onClick={() => setForm((f) => ({ ...f, class_: cls }))}
                            >
                              {cls === "KG1" || cls === "KG2" ? cls : `Class ${cls}`}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {step === 2 && (
                <div>
                  <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>
                    Which subject feels hardest?
                  </h2>
                  <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 20 }}>
                    Sakhi will give it extra attention.
                  </p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {subjects.map((s) => (
                      <button
                        key={s.id}
                        className={`subject-chip ${form.weak_subject === s.label ? "selected" : ""}`}
                        onClick={() => setForm((f) => ({ ...f, weak_subject: s.label }))}
                      >
                        <span>{s.icon}</span> {s.label}
                        {form.weak_subject === s.label && <Check size={13} style={{ marginLeft: 2 }} />}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {step === 3 && (
                <div>
                  <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>
                    How should Sakhi respond?
                  </h2>
                  <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 20 }}>
                    You can change this any time from the sidebar.
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {LANGUAGES.map((lang) => (
                      <button
                        key={lang.id}
                        onClick={() => setForm((f) => ({ ...f, language: lang.id }))}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "12px 16px",
                          background: form.language === lang.id ? "var(--emerald-light)" : "white",
                          border: `1.5px solid ${form.language === lang.id ? "var(--emerald)" : "var(--border)"}`,
                          borderRadius: "var(--radius-lg)",
                          cursor: "pointer",
                          textAlign: "left",
                          fontFamily: "Inter, sans-serif",
                          transition: "all 0.15s",
                          width: "100%",
                        }}
                      >
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{lang.label}</div>
                          <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{lang.sub}</div>
                        </div>
                        {form.language === lang.id && (
                          <div style={{ width: 20, height: 20, borderRadius: "50%", background: "var(--emerald)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <Check size={12} color="white" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {step === 4 && (
                <div>
                  <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>
                    Which role are you demoing?
                  </h2>
                  <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 20 }}>
                    This helps Sakhi shape the right dashboard and insights.
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {ROLES.map((role) => (
                      <button
                        key={role.id}
                        onClick={() => setForm((f) => ({ ...f, role: role.id }))}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "12px 16px",
                          background: form.role === role.id ? "var(--emerald-light)" : "white",
                          border: `1.5px solid ${form.role === role.id ? "var(--emerald)" : "var(--border)"}`,
                          borderRadius: "var(--radius-lg)",
                          cursor: "pointer",
                          textAlign: "left",
                          fontFamily: "Inter, sans-serif",
                          transition: "all 0.15s",
                          width: "100%",
                        }}
                      >
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{role.label}</div>
                          <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{role.sub}</div>
                        </div>
                        {form.role === role.id && (
                          <div style={{ width: 20, height: 20, borderRadius: "50%", background: "var(--emerald)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <Check size={12} color="white" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 28, paddingTop: 20, borderTop: "1px solid var(--border-subtle)" }}>
            <button
              className="btn btn-ghost"
              onClick={() => go(-1)}
              style={{ visibility: step === 0 ? "hidden" : "visible" }}
            >
              ← Back
            </button>

            {step < STEPS.length - 1 ? (
              <button
                className="btn btn-primary"
                disabled={step === 0 ? !form.name.trim() : step === 2 ? !form.weak_subject : false}
                onClick={() => go(1)}
                style={{ opacity: (step === 0 && !form.name.trim()) || (step === 2 && !form.weak_subject) ? 0.5 : 1 }}
              >
                Continue <ArrowRight size={15} />
              </button>
            ) : (
              <button
                className="btn btn-primary"
                onClick={submit}
                disabled={loading}
                style={{ opacity: loading ? 0.7 : 1 }}
              >
                {loading ? "Setting up..." : "Start Learning 🌸"}
              </button>
            )}
          </div>
        </div>

        <p style={{ textAlign: "center", fontSize: 12, color: "var(--text-muted)", marginTop: 20 }}>
          Free to use · NCERT-aligned · KG to Class 12
        </p>
      </div>
    </div>
  );
}
