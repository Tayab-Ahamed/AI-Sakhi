"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

type TourStep = {
  title: string;
  body: string;
  position?: "top" | "bottom" | "center";
};

const TOUR_STEPS: TourStep[] = [
  { title: "👋 Welcome to AI Sakhi!", body: "Your personal AI learning companion. Let me show you around in just a few steps.", position: "center" },
  { title: "💬 Chat with Sakhi", body: "Ask any question in your language — English, Hindi, Kannada, Tamil or Hinglish. Sakhi always explains clearly.", position: "center" },
  { title: "🎯 Take Adaptive Quizzes", body: "Quizzes auto-adjust difficulty based on your performance. Earn XP for every quiz you complete!", position: "center" },
  { title: "🃏 Spaced Repetition Flashcards", body: "Review cards at optimal intervals using the SM-2 algorithm. Science-backed memory retention!", position: "center" },
  { title: "📊 Track Your Progress", body: "Your dashboard shows streaks, XP level, mastery heatmap, and weak topic recommendations.", position: "center" },
  { title: "🌙 You're all set!", body: "You can toggle dark mode, change language, and access all features from the sidebar. Happy learning! 🌸", position: "center" },
];

const TOUR_KEY = "sakhi_tour_done";

export default function TourGuide() {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const done = localStorage.getItem(TOUR_KEY);
    if (!done) {
      const timer = setTimeout(() => setVisible(true), 1200);
      return () => clearTimeout(timer);
    }
  }, []);

  const dismiss = () => {
    setVisible(false);
    localStorage.setItem(TOUR_KEY, "1");
  };

  const next = () => {
    if (step < TOUR_STEPS.length - 1) {
      setStep((s) => s + 1);
    } else {
      dismiss();
    }
  };

  if (!visible) return null;

  const current = TOUR_STEPS[step];

  return (
    <>
      <div className="tour-overlay" onClick={dismiss} />
      <div className="tour-tooltip" style={{ top: "50%", left: "50%", transform: "translate(-50%, -50%)" }}>
        <button
          onClick={dismiss}
          style={{ position: "absolute", top: 12, right: 12, background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}
          aria-label="Close tour"
        >
          <X size={16} />
        </button>
        <div className="tour-title">{current.title}</div>
        <div className="tour-body">{current.body}</div>
        <div className="tour-footer">
          <span className="tour-step-indicator">{step + 1} / {TOUR_STEPS.length}</span>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-ghost" style={{ fontSize: 12, padding: "5px 10px" }} onClick={dismiss}>Skip</button>
            <button className="btn btn-primary" style={{ fontSize: 13, padding: "7px 14px" }} onClick={next}>
              {step < TOUR_STEPS.length - 1 ? "Next →" : "Let's go! 🌸"}
            </button>
          </div>
        </div>
        <div style={{ display: "flex", gap: 4, justifyContent: "center", marginTop: 12 }}>
          {TOUR_STEPS.map((_, i) => (
            <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: i === step ? "var(--emerald)" : "var(--border)", transition: "background 0.2s" }} />
          ))}
        </div>
      </div>
    </>
  );
}
