"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { ChevronRight, Sparkles, MessageSquare, Zap, Clock, Trophy } from "lucide-react";

const SLIDES = [
  {
    title: "Meet AI Sakhi",
    subtitle: "Your Personal Study Companion",
    desc: "A SaaS-grade educational platform built for Indian students. Multilingual, empathetic, and distraction-free learning.",
    icon: <Sparkles size={48} style={{ color: "#059669" }} />,
    bg: "linear-gradient(135deg, #f0fdf4 0%, #d1fae5 100%)",
  },
  {
    title: "Doubt Solving",
    subtitle: "Multilingual Chat & Voice",
    desc: "Speak your doubts or upload a PDF. Sakhi explains concepts simply, translates to 5 languages, and even tells stories to simplify complex topics.",
    icon: <MessageSquare size={48} style={{ color: "#2563eb" }} />,
    bg: "linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)",
  },
  {
    title: "Adaptive Quizzes",
    subtitle: "Learn by doing",
    desc: "AI-generated 5-question quizzes with Easy, Medium, and Hard difficulties. Earn XP, get instant feedback, and celebrate perfect scores with confetti!",
    icon: <Zap size={48} style={{ color: "#ca8a04" }} />,
    bg: "linear-gradient(135deg, #fefce8 0%, #fef08a 100%)",
  },
  {
    title: "Structured Study",
    subtitle: "Plans & Focus Timer",
    desc: "Generate bite-sized study plans and execute them instantly with the built-in Pomodoro Focus Timer. Stay on track without leaving the app.",
    icon: <Clock size={48} style={{ color: "#9333ea" }} />,
    bg: "linear-gradient(135deg, #fdf4ff 0%, #f3e8ff 100%)",
  },
  {
    title: "Gamification",
    subtitle: "Dashboard & Leaderboard",
    desc: "Track streaks, earn badges, and compete on the Leaderboard. Includes Parent/Teacher insights and 1-click PDF report exports.",
    icon: <Trophy size={48} style={{ color: "#ea580c" }} />,
    bg: "linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)",
  },
];

export default function DemoPage() {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrent((c) => (c + 1) % SLIDES.length);
    }, 6000); // auto advance every 6s
    return () => clearInterval(timer);
  }, []);

  const handleKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowRight" || e.key === " ") {
      setCurrent((c) => (c + 1) % SLIDES.length);
    } else if (e.key === "ArrowLeft") {
      setCurrent((c) => (c - 1 + SLIDES.length) % SLIDES.length);
    }
  };

  useEffect(() => {
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  return (
    <div style={{ width: "100vw", height: "100vh", overflow: "hidden", background: "#111827", position: "relative", color: "white", fontFamily: "Inter, sans-serif" }}>
      <AnimatePresence mode="wait">
        <motion.div
          key={current}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.05 }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
          style={{
            position: "absolute", inset: 0, display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", background: SLIDES[current].bg,
            color: "#111827", padding: "40px", textAlign: "center"
          }}
        >
          <div style={{ width: 100, height: 100, background: "white", borderRadius: 24, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 32, boxShadow: "0 20px 40px rgba(0,0,0,0.1)" }}>
            {SLIDES[current].icon}
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(0,0,0,0.5)", marginBottom: 12 }}>
            {SLIDES[current].subtitle}
          </h2>
          <h1 style={{ fontSize: 64, fontWeight: 800, letterSpacing: "-2px", marginBottom: 24, lineHeight: 1.1 }}>
            {SLIDES[current].title}
          </h1>
          <p style={{ fontSize: 24, maxWidth: 800, lineHeight: 1.6, color: "rgba(0,0,0,0.7)" }}>
            {SLIDES[current].desc}
          </p>
        </motion.div>
      </AnimatePresence>

      <div style={{ position: "absolute", bottom: 40, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 12, zIndex: 10 }}>
        {SLIDES.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrent(i)}
            style={{
              width: current === i ? 32 : 12, height: 12, borderRadius: 6,
              background: current === i ? "#111827" : "rgba(17,24,39,0.2)",
              border: "none", cursor: "pointer", transition: "all 0.3s"
            }}
          />
        ))}
      </div>

      <Link href="/dashboard" style={{ position: "absolute", top: 40, right: 40, zIndex: 10, padding: "12px 24px", background: "#111827", color: "white", borderRadius: 100, textDecoration: "none", fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
        Exit Demo <ChevronRight size={16} />
      </Link>
      
      <div style={{ position: "absolute", bottom: 40, right: 40, color: "rgba(17,24,39,0.4)", fontSize: 13, zIndex: 10, fontWeight: 500 }}>
        Press <kbd style={{ background: "white", padding: "2px 6px", borderRadius: 4, border: "1px solid rgba(0,0,0,0.1)" }}>Space</kbd> or <kbd style={{ background: "white", padding: "2px 6px", borderRadius: 4, border: "1px solid rgba(0,0,0,0.1)" }}>→</kbd> to advance
      </div>
    </div>
  );
}
