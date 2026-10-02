"use client";

import { Suspense, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { getLevels, getSubjectsForClass } from "@/lib/curriculum";
import { useUser } from "@/lib/user-context";
import { getRoleLandingPage, ROLE_CONFIG } from "@/lib/auth";
import { BrandMark } from "@/components/BrandMark";
import {
  ArrowRight,
  ArrowLeft,
  Check,
  Eye,
  EyeSlash,
} from "@phosphor-icons/react";

const LANGUAGES = [
  { id: "English", label: "English", sub: "Default for most subjects" },
  { id: "Hinglish", label: "Hinglish", sub: "Mix of Hindi and English" },
  { id: "Hindi", label: "हिन्दी", sub: "Pure Hindi responses" },
  { id: "Kannada", label: "ಕನ್ನಡ", sub: "Kannada responses" },
  { id: "Tamil", label: "தமிழ்", sub: "Tamil responses" },
];

function getSteps() {
  return ["Your Name", "Class", "Focus Subject", "Language", "Password"];
}

function OnboardForm() {
  const router = useRouter();
  const validRole = "student";

  const { setUser } = useUser();
  const [form, setForm] = useState({
    name: "",
    class_: "9",
    language: "English",
    weak_subject: "",
    role: validRole,
    password: "",
    confirmPassword: "",
  });
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pwError, setPwError] = useState("");

  const isStudent = form.role === "student";
  const STEPS = getSteps();
  const totalSteps = STEPS.length;

  const levels = getLevels();
  const subjects = getSubjectsForClass(form.class_);
  const cfg = ROLE_CONFIG[form.role] || ROLE_CONFIG.student;

  const go = (n: number) => {
    setDir(n);
    setStep((s) => s + n);
  };

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
    if (form.password.length < 8) {
      setPwError("Password must be at least 8 characters.");
      return;
    }
    if (form.password !== form.confirmPassword) {
      setPwError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res = await (api as any).createUser({
        name: form.name,
        class_: form.class_,
        language: form.language,
        weak_subject: form.weak_subject,
        role: "student",
        password: form.password,
      }) as { user_id: number; auth?: unknown } & Record<string, unknown>;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setUser({ ...res, ...form } as any, (res.auth as any) || null);
      router.push(getRoleLandingPage((res.role as string) || "student"));
    } catch {
      alert("Cannot reach backend. Make sure the API server is running on port 8000.");
    } finally {
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    background: "#fbfdfb",
    border: "1px solid #dce5df",
    borderRadius: 12,
    padding: "12px 16px",
    fontSize: 15,
    fontFamily: "Inter, system-ui, sans-serif",
    color: "#17201c",
    outline: "none",
    boxSizing: "border-box",
    transition: "border-color 0.15s, box-shadow 0.15s",
  };

  const renderStep = () => {
    const nameIdx = 0;
    const classIdx = 1;
    const subjectIdx = 2;
    const langIdx = 3;
    const pwIdx = 4;

    if (step === nameIdx) {
      return (
        <div>
          <h2 className="text-xl font-bold text-[#17201c] mb-1 tracking-tight">What is your name?</h2>
          <p className="text-xs text-[#66716b] mb-6">Sakhi will use this to personalize your learning journey.</p>
          <input
            style={inputStyle}
            aria-label="Full name"
            placeholder="Enter your full name"
            value={form.name}
            autoFocus
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            onKeyDown={(e) => e.key === "Enter" && form.name.trim() && go(1)}
            onFocus={(e) => {
              e.target.style.borderColor = "#059669";
              e.target.style.boxShadow = "0 0 0 3px rgba(5,150,105,0.16)";
            }}
            onBlur={(e) => {
              e.target.style.borderColor = "#dce5df";
              e.target.style.boxShadow = "none";
            }}
          />
        </div>
      );
    }

    if (step === classIdx) {
      return (
        <div>
          <h2 className="text-xl font-bold text-[#17201c] mb-1 tracking-tight">Hi {form.name}! Which grade?</h2>
          <p className="text-xs text-[#66716b] mb-5">We will align topics directly with your NCERT curriculum.</p>
          <div className="flex flex-col gap-4">
            {levels.map((level) => (
              <div key={level.id}>
                <p className="text-[11px] font-semibold text-[#7b867f] uppercase tracking-wider mb-2">
                  {level.label}
                </p>
                <div className="flex flex-wrap gap-2">
                  {level.classes.map((cls) => {
                    const isSelected = form.class_ === cls;
                    return (
                      <button
                        key={cls}
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, class_: cls }))}
                        className="px-3.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all"
                        style={{
                          background: isSelected ? "#e4f5eb" : "#ffffff",
                          border: isSelected ? "1px solid #059669" : "1px solid #dce5df",
                          color: isSelected ? "#047857" : "#425148",
                        }}
                      >
                        {cls === "KG1" || cls === "KG2" ? cls : `Class ${cls}`}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (step === subjectIdx) {
      return (
        <div>
          <h2 className="text-xl font-bold text-[#17201c] mb-1 tracking-tight">Which subject needs extra focus?</h2>
          <p className="text-xs text-[#66716b] mb-5">Sakhi will dedicate more Socratic scaffolding to this area.</p>
          <div className="flex flex-wrap gap-2">
            {subjects.map((s) => {
              const isSelected = form.weak_subject === s.label;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, weak_subject: s.label }))}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium cursor-pointer transition-all"
                  style={{
                    background: isSelected ? "#e4f5eb" : "#ffffff",
                    border: isSelected ? "1px solid #059669" : "1px solid #dce5df",
                    color: isSelected ? "#047857" : "#425148",
                  }}
                >
                  <span>{s.icon}</span>
                  <span>{s.label}</span>
                  {isSelected && <Check size={12} weight="bold" className="ml-1" />}
                </button>
              );
            })}
          </div>
        </div>
      );
    }

    if (step === langIdx) {
      return (
        <div>
          <h2 className="text-xl font-bold text-[#17201c] mb-1 tracking-tight">Preferred study language?</h2>
          <p className="text-xs text-[#66716b] mb-5">You can switch languages anytime during your session.</p>
          <div className="flex flex-col gap-2">
            {LANGUAGES.map((l) => {
              const isSelected = form.language === l.id;
              return (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, language: l.id }))}
                  className="flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all text-left"
                  style={{
                    background: isSelected ? "#e4f5eb" : "#ffffff",
                    border: isSelected ? "1px solid #059669" : "1px solid #dce5df",
                  }}
                >
                  <div>
                    <div className="text-sm font-semibold text-[#17201c]">{l.label}</div>
                    <div className="text-xs text-[#66716b]">{l.sub}</div>
                  </div>
                  {isSelected && (
                    <div
                      className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                      style={{ background: "#059669" }}
                    >
                      <Check size={12} weight="bold" color="#fff" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      );
    }

    if (step === pwIdx) {
      return (
        <div>
          <h2 className="text-xl font-bold text-[#17201c] mb-1 tracking-tight">Create a password</h2>
          <p className="text-xs text-[#66716b] mb-5">You will use this to sign into your account.</p>
          <div className="flex flex-col gap-3.5">
            <div className="relative">
              <input
                style={{ ...inputStyle, paddingRight: 40 }}
                aria-label="Password"
                type={showPw ? "text" : "password"}
                placeholder="Password (min 8 chars)"
                value={form.password}
                onChange={(e) => {
                  setForm((f) => ({ ...f, password: e.target.value }));
                  setPwError("");
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = "#059669";
                  e.target.style.boxShadow = "0 0 0 3px rgba(5,150,105,0.16)";
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = "#dce5df";
                  e.target.style.boxShadow = "none";
                }}
              />
              <button
                type="button"
                onClick={() => setShowPw((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer p-1 text-[#7b867f]"
                aria-label="Toggle password visibility"
              >
                {showPw ? <EyeSlash size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <div className="relative">
              <input
                style={{ ...inputStyle, paddingRight: 40 }}
                aria-label="Confirm password"
                type={showConfirm ? "text" : "password"}
                placeholder="Confirm password"
                value={form.confirmPassword}
                onChange={(e) => {
                  setForm((f) => ({ ...f, confirmPassword: e.target.value }));
                  setPwError("");
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = "#059669";
                  e.target.style.boxShadow = "0 0 0 3px rgba(5,150,105,0.16)";
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = "#dce5df";
                  e.target.style.boxShadow = "none";
                }}
              />
              <button
                type="button"
                onClick={() => setShowConfirm((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer p-1 text-[#7b867f]"
                aria-label="Toggle confirm password visibility"
              >
                {showConfirm ? <EyeSlash size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {pwError && <p className="text-xs text-[#f43f5e]">{pwError}</p>}
          </div>
        </div>
      );
    }

    return null;
  };

  const isLastStep = step === totalSteps - 1;

  return (
    <div
      className="onboard-page min-h-[100dvh] w-full flex flex-col items-center justify-center px-4 py-12 relative"
      style={{
        background: "#f5f7f5",
        color: "#17201c",
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      <Link href="/" className="onboard-brand" aria-label="AI Sakhi home">
        <BrandMark size="sm" showLabel />
      </Link>
      {/* Back to Home */}
      <Link
        href="/"
        className="absolute top-6 left-6 inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
        style={{
          background: "#ffffff",
          border: "1px solid #e1e8e3",
          color: "#66716b",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = "#17201c";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = "#66716b";
        }}
      >
        <ArrowLeft size={14} /> Back to Home
      </Link>

      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-6">
          <div
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium mb-2"
            style={{
                background: "#e4f5eb",
                border: "1px solid #c6e8d3",
                color: "#047857",
            }}
          >
            <span>{cfg.emoji}</span>
            <span>Creating {cfg.label} Account</span>
          </div>
        <p className="text-xs text-[#66716b]">
            Already have an account?{" "}
            <Link href={`/login?role=${form.role}`} className="font-medium hover:underline text-[#047857]">
              Sign in →
            </Link>
          </p>
        </div>

        {/* Progress bar pills */}
        <div className="flex justify-center gap-1.5 mb-6">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className="h-1 rounded-full transition-all duration-300"
              style={{
                width: i === step ? 28 : 10,
                background: i <= step ? "#059669" : "#d9e3dc",
              }}
            />
          ))}
        </div>

        {/* Double-Bezel Card */}
        <div
          style={{
            padding: 6,
            background: "#edf3ee",
            border: "1px solid #dce7df",
            borderRadius: 24,
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: 19,
              border: "1px solid #e4ebe6",
              boxShadow: "0 18px 50px rgba(30, 65, 45, .08)",
              padding: "2.25rem 2rem",
            }}
          >
            <div className="text-[11px] font-semibold text-[#047857] uppercase tracking-wider mb-2">
              Step {step + 1} of {totalSteps} · {STEPS[step]}
            </div>

            <AnimatePresence mode="wait" custom={dir}>
              <motion.div
                key={step}
                custom={dir}
                initial={{ opacity: 0, x: dir * 18 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -dir * 18 }}
                transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
              >
                {renderStep()}
              </motion.div>
            </AnimatePresence>

            {/* Actions */}
            <div className="flex items-center justify-between mt-8 pt-5" style={{ borderTop: "1px solid #e6ece8" }}>
              {step > 0 ? (
                <button
                  type="button"
                  onClick={() => go(-1)}
                  className="flex items-center gap-1.5 text-xs text-[#66716b] hover:text-[#17201c] cursor-pointer transition-colors"
                >
                  <ArrowLeft size={13} /> Back
                </button>
              ) : (
                <Link
                  href="/"
                  className="flex items-center gap-1.5 text-xs text-[#66716b] hover:text-[#17201c] transition-colors"
                >
                  <ArrowLeft size={13} /> Change role
                </Link>
              )}

              {isLastStep ? (
                <button
                  type="button"
                  onClick={submit}
                  disabled={loading}
                  className="onboard-action flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-semibold cursor-pointer transition-all active:scale-[0.98] disabled:opacity-50"
                  style={{
                    background: "#059669",
                    color: "#ffffff",
                  }}
                  onMouseEnter={(e) => {
                    if (!e.currentTarget.disabled) e.currentTarget.style.background = "#047857";
                  }}
                  onMouseLeave={(e) => {
                    if (!e.currentTarget.disabled) e.currentTarget.style.background = "#047857";
                  }}
                >
                  {loading ? "Creating..." : "Start Learning"}
                  <ArrowRight size={13} weight="bold" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => go(1)}
                  disabled={!canNext()}
                  className="onboard-action flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-semibold cursor-pointer transition-all active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed"
                  style={{
                    background: "#059669",
                    color: "#ffffff",
                  }}
                  onMouseEnter={(e) => {
                    if (!e.currentTarget.disabled) e.currentTarget.style.background = "#047857";
                  }}
                  onMouseLeave={(e) => {
                    if (!e.currentTarget.disabled) e.currentTarget.style.background = "#047857";
                  }}
                >
                  Continue <ArrowRight size={13} weight="bold" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function OnboardPage() {
  return (
    <Suspense
      fallback={
        <div
          className="min-h-screen flex items-center justify-center"
          style={{ background: "#f5f7f5" }}
        >
          <div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
        </div>
      }
    >
      <OnboardForm />
    </Suspense>
  );
}
