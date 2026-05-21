"use client";

import { Suspense, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { getLevels, getSubjectsForClass } from "@/lib/curriculum";
import { useUser } from "@/lib/user-context";
import { getRoleLandingPage, ROLE_CONFIG } from "@/lib/auth";
import { ArrowRight, ArrowLeft, Check, Eye, EyeOff } from "lucide-react";

const LANGUAGES = [
  { id: "English",  label: "English",  sub: "Default for most subjects" },
  { id: "Hinglish", label: "Hinglish", sub: "Mix of Hindi and English" },
  { id: "Hindi",    label: "हिन्दी",    sub: "Pure Hindi responses" },
  { id: "Kannada",  label: "ಕನ್ನಡ",    sub: "Kannada responses" },
  { id: "Tamil",    label: "தமிழ்",   sub: "Tamil responses" },
];

const ROLES = [
  { id: "student", label: "Student",  sub: "Personal learning companion" },
  { id: "parent",  label: "Parent",   sub: "Track your child's progress" },
  { id: "teacher", label: "Teacher",  sub: "Manage assignments and students" },
  { id: "admin",   label: "Admin",    sub: "Platform-wide management" },
];

// Steps for student: Name → Class → Weak Subject → Language → Role → Password
// Steps for others:  Name → Language → Role → Password
function getSteps(role: string) {
  if (role === "student") return ["Your Name", "Class", "Weak Subject", "Language", "Role", "Password"];
  return ["Your Name", "Language", "Role", "Password"];
}

function OnboardForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preRole = searchParams.get("role") || "student";
  const validRole = preRole in ROLE_CONFIG ? preRole : "student";

  const { setUser } = useUser();
  const [form, setForm] = useState({
    name: "", class_: "9", language: "English",
    weak_subject: "", role: validRole, password: "", confirmPassword: "",
  });
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pwError, setPwError] = useState("");

  const isStudent = form.role === "student";
  const STEPS = getSteps(form.role);
  const totalSteps = STEPS.length;

  const levels = getLevels();
  const subjects = getSubjectsForClass(form.class_);
  const cfg = ROLE_CONFIG[form.role] || ROLE_CONFIG.student;

  const go = (n: number) => { setDir(n); setStep(s => s + n); };

  const canNext = () => {
    if (isStudent) {
      if (step === 0) return form.name.trim().length > 0;
      if (step === 2) return form.weak_subject.length > 0;
      return true;
    } else {
      if (step === 0) return form.name.trim().length > 0;
      return true;
    }
  };

  const submit = async () => {
    setPwError("");
    if (form.password.length < 6) { setPwError("Password must be at least 6 characters."); return; }
    if (form.password !== form.confirmPassword) { setPwError("Passwords do not match."); return; }
    setLoading(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res = await (api as any).createUser({
        name: form.name, class_: form.class_, language: form.language,
        weak_subject: form.weak_subject, role: form.role, password: form.password,
      }) as { user_id: number; auth?: unknown } & Record<string, unknown>;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setUser({ ...res, ...form } as any, (res.auth as any) || null);
      router.push(getRoleLandingPage(form.role));
    } catch {
      alert("Cannot reach backend. Make sure FastAPI is running on port 8000.");
    } finally {
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 12,
    padding: "12px 16px", fontSize: 15, fontFamily: "Inter, sans-serif",
    color: "var(--text-primary)", outline: "none", boxSizing: "border-box",
    transition: "border-color 0.15s, box-shadow 0.15s",
  };

  // Resolve which "step index" maps to which content for each role type
  const renderStep = () => {
    // For students: 0=Name, 1=Class, 2=Subject, 3=Language, 4=Role, 5=Password
    // For others:   0=Name, 1=Language, 2=Role, 3=Password
    const nameIdx = 0;
    const classIdx = isStudent ? 1 : -1;
    const subjectIdx = isStudent ? 2 : -1;
    const langIdx = isStudent ? 3 : 1;
    const roleIdx = isStudent ? 4 : 2;
    const pwIdx = isStudent ? 5 : 3;

    if (step === nameIdx) return (
      <div>
        <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>What&apos;s your name?</h2>
        <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 24 }}>Sakhi will use this to personalise your experience.</p>
        <input style={inputStyle} placeholder="Enter your full name" value={form.name} autoFocus
          onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
          onKeyDown={(e) => e.key === "Enter" && form.name.trim() && go(1)}
          onFocus={(e) => { e.target.style.borderColor = cfg.color; e.target.style.boxShadow = `0 0 0 3px ${cfg.color}18`; }}
          onBlur={(e) => { e.target.style.borderColor = "var(--border)"; e.target.style.boxShadow = "none"; }}
        />
      </div>
    );

    if (step === classIdx) return (
      <div>
        <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>Hi {form.name}! Which class?</h2>
        <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 20 }}>We&apos;ll tailor the NCERT curriculum to your level.</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {levels.map((level) => (
            <div key={level.id}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 6 }}>{level.label}</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {level.classes.map((cls) => (
                  <button key={cls} className={`class-btn ${form.class_ === cls ? "selected" : ""}`}
                    onClick={() => setForm(f => ({ ...f, class_: cls }))}
                    style={form.class_ === cls ? { borderColor: cfg.color, background: cfg.color + "18", color: cfg.color } : {}}>
                    {cls === "KG1" || cls === "KG2" ? cls : `Class ${cls}`}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );

    if (step === subjectIdx) return (
      <div>
        <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>Which subject feels hardest?</h2>
        <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 20 }}>Sakhi will give it extra attention.</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {subjects.map((s) => (
            <button key={s.id} className={`subject-chip ${form.weak_subject === s.label ? "selected" : ""}`}
              onClick={() => setForm(f => ({ ...f, weak_subject: s.label }))}
              style={form.weak_subject === s.label ? { borderColor: cfg.color, background: cfg.color + "18", color: cfg.color } : {}}>
              <span>{s.icon}</span> {s.label}
              {form.weak_subject === s.label && <Check size={13} style={{ marginLeft: 2 }} />}
            </button>
          ))}
        </div>
      </div>
    );

    if (step === langIdx) return (
      <div>
        <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>Preferred language?</h2>
        <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 20 }}>You can change this any time from the sidebar.</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {LANGUAGES.map((lang) => (
            <button key={lang.id} onClick={() => setForm(f => ({ ...f, language: lang.id }))} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px",
              background: form.language === lang.id ? cfg.color + "14" : "var(--bg-surface)",
              border: `1.5px solid ${form.language === lang.id ? cfg.color : "var(--border)"}`,
              borderRadius: 12, cursor: "pointer", textAlign: "left", fontFamily: "Inter, sans-serif",
              transition: "all 0.15s", width: "100%",
            }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{lang.label}</div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{lang.sub}</div>
              </div>
              {form.language === lang.id && (
                <div style={{ width: 22, height: 22, borderRadius: "50%", background: cfg.color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Check size={13} color="white" />
                </div>
              )}
            </button>
          ))}
        </div>
      </div>
    );

    if (step === roleIdx) return (
      <div>
        <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>Confirm your role</h2>
        <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 20 }}>This shapes your dashboard and tools.</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {ROLES.map((r) => (
            <button key={r.id} onClick={() => setForm(f => ({ ...f, role: r.id }))} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px",
              background: form.role === r.id ? (ROLE_CONFIG[r.id]?.color || cfg.color) + "14" : "var(--bg-surface)",
              border: `1.5px solid ${form.role === r.id ? (ROLE_CONFIG[r.id]?.color || cfg.color) : "var(--border)"}`,
              borderRadius: 12, cursor: "pointer", fontFamily: "Inter, sans-serif", transition: "all 0.15s", width: "100%",
            }}>
              <div style={{ textAlign: "left" }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{r.label}</div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{r.sub}</div>
              </div>
              {form.role === r.id && (
                <div style={{ width: 22, height: 22, borderRadius: "50%", background: ROLE_CONFIG[r.id]?.color || cfg.color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Check size={13} color="white" />
                </div>
              )}
            </button>
          ))}
        </div>
      </div>
    );

    if (step === pwIdx) return (
      <div>
        <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>Create a password</h2>
        <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 24 }}>You&apos;ll use this to sign in next time.</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ position: "relative" }}>
            <input style={{ ...inputStyle, paddingRight: 44 }} type={showPw ? "text" : "password"} placeholder="Password (min 6 chars)"
              value={form.password} onChange={(e) => { setForm(f => ({ ...f, password: e.target.value })); setPwError(""); }}
              onFocus={(e) => { e.target.style.borderColor = cfg.color; e.target.style.boxShadow = `0 0 0 3px ${cfg.color}18`; }}
              onBlur={(e) => { e.target.style.borderColor = "var(--border)"; e.target.style.boxShadow = "none"; }}
            />
            <button type="button" onClick={() => setShowPw(s => !s)}
              style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", display: "flex" }}>
              {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <div style={{ position: "relative" }}>
            <input style={{ ...inputStyle, paddingRight: 44 }} type={showConfirm ? "text" : "password"} placeholder="Confirm password"
              value={form.confirmPassword} onChange={(e) => { setForm(f => ({ ...f, confirmPassword: e.target.value })); setPwError(""); }}
              onFocus={(e) => { e.target.style.borderColor = cfg.color; e.target.style.boxShadow = `0 0 0 3px ${cfg.color}18`; }}
              onBlur={(e) => { e.target.style.borderColor = "var(--border)"; e.target.style.boxShadow = "none"; }}
            />
            <button type="button" onClick={() => setShowConfirm(s => !s)}
              style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", display: "flex" }}>
              {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {pwError && <p style={{ fontSize: 13, color: "#dc2626", margin: 0 }}>{pwError}</p>}
        </div>
      </div>
    );

    return null;
  };

  const isLastStep = step === totalSteps - 1;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-app)", display: "flex", alignItems: "center", justifyContent: "center", padding: "32px 16px" }}>
      <div style={{ width: "100%", maxWidth: 520 }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 38, marginBottom: 8 }}>🌸</div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "5px 14px", borderRadius: 99, background: cfg.color + "14", border: `1px solid ${cfg.color}40`, marginBottom: 4 }}>
            <span style={{ fontSize: 14 }}>{cfg.emoji}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: cfg.color }}>Creating {cfg.label} account</span>
          </div>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 8 }}>
            Already have an account?{" "}
            <button onClick={() => router.push(`/login?role=${form.role}`)} style={{ background: "none", border: "none", color: cfg.color, fontWeight: 700, cursor: "pointer", fontSize: 13, fontFamily: "Inter, sans-serif" }}>
              Sign in →
            </button>
          </p>
        </div>

        {/* Progress dots */}
        <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 24 }}>
          {STEPS.map((_, i) => (
            <div key={i} style={{
              height: 6, borderRadius: 3,
              width: i === step ? 24 : 8,
              background: i <= step ? cfg.color : "var(--border)",
              transition: "all 0.3s",
            }} />
          ))}
        </div>

        <div className="card" style={{ padding: 32, overflow: "hidden" }}>
          {/* Step label */}
          <div style={{ fontSize: 12, fontWeight: 700, color: cfg.color, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12 }}>
            Step {step + 1} of {totalSteps} · {STEPS[step]}
          </div>

          <AnimatePresence custom={dir} mode="wait">
            <motion.div key={step} custom={dir}
              initial={{ x: dir > 0 ? 30 : -30, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: dir > 0 ? -30 : 30, opacity: 0 }}
              transition={{ duration: 0.22, ease: "easeOut" }}>
              {renderStep()}
            </motion.div>
          </AnimatePresence>

          {/* Navigation */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 28, paddingTop: 20, borderTop: "1px solid var(--border-subtle)" }}>
            <button className="btn btn-ghost" onClick={() => step === 0 ? router.push("/") : go(-1)}>
              <ArrowLeft size={15} /> {step === 0 ? "Change role" : "Back"}
            </button>

            {isLastStep ? (
              <button className="btn" disabled={loading || !form.password || !form.confirmPassword} onClick={submit}
                style={{
                  background: (loading || !form.password || !form.confirmPassword) ? "var(--border)" : cfg.bg,
                  color: (loading || !form.password || !form.confirmPassword) ? "var(--text-muted)" : "white",
                  border: "none", borderRadius: 12, padding: "10px 20px", fontSize: 14, fontWeight: 700,
                  cursor: "pointer", display: "flex", alignItems: "center", gap: 8, fontFamily: "Inter, sans-serif",
                }}>
                {loading ? "Creating account…" : `Create ${cfg.label} Account 🌸`}
              </button>
            ) : (
              <button className="btn" disabled={!canNext()} onClick={() => go(1)}
                style={{
                  background: canNext() ? cfg.bg : "var(--border)",
                  color: canNext() ? "white" : "var(--text-muted)",
                  border: "none", borderRadius: 12, padding: "10px 20px", fontSize: 14, fontWeight: 700,
                  cursor: canNext() ? "pointer" : "not-allowed", display: "flex", alignItems: "center", gap: 8, fontFamily: "Inter, sans-serif",
                }}>
                Continue <ArrowRight size={15} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function OnboardPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: "100vh", background: "var(--bg-app)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontSize: 36 }}>🌸</div>
      </div>
    }>
      <OnboardForm />
    </Suspense>
  );
}
