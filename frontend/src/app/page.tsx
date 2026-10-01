"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useUser } from "@/lib/user-context";
import { getRoleLandingPage } from "@/lib/auth";

// ── Phosphor Icons (ultra-light strokes — no lucide) ─────────────
import {
  Student,
  Chalkboard,
  Users,
  ShieldCheck,
  ArrowRight,
  Brain,
  Timer,
  ArrowsCounterClockwise,
  ChartLineUp,
  BookOpenText,
  Sparkle,
  CaretRight,
  X,
  List,
} from "@phosphor-icons/react";

// ── Spring cubic bezier ───────────────────────────────────────────
const SPRING = "cubic-bezier(0.32,0.72,0,1)";

// ── Linear-tier design tokens ─────────────────────────────────────
// canvas: #010102 | surface-1: #0f1011 | surface-2: #141516
// accent: #5e6ad2 | ink: #f7f8f8 | ink-muted: #8a8f98
// hairline: #23252a

// ── Role portal definitions ───────────────────────────────────────
const ROLES = [
  {
    id: "student",
    label: "Student",
    subtitle: "KG – Class 12",
    tagline:
      "Patient Socratic dialogue, 25-min Smart Sprints, spaced recall — all in one adaptive session.",
    icon: Student,
    href: "/login?role=student",
    features: ["Socratic Guidance", "Smart Sprints", "SM-2 Spaced Recall", "Misconception Pinpointing"],
  },
  {
    id: "teacher",
    label: "Teacher",
    subtitle: "CBSE & ICSE",
    tagline:
      "Curriculum-aligned question forge, batch submission review, and targeted intervention signals.",
    icon: Chalkboard,
    href: "/login?role=teacher",
    features: ["Question Bank Forge", "Batch Review", "Intervention Signals", "Learning Outcome Map"],
  },
  {
    id: "parent",
    label: "Guardian",
    subtitle: "Family Oversight",
    tagline:
      "Weekly digest of learning progress, session quality metrics, and skill mastery milestones.",
    icon: Users,
    href: "/login?role=parent",
    features: ["Weekly Digest", "Progress Timeline", "Skill Milestones", "Session Quality"],
  },
  {
    id: "admin",
    label: "Admin",
    subtitle: "School & Platform",
    tagline:
      "Institutional analytics, multi-section oversight, and full audit trail for compliance.",
    icon: ShieldCheck,
    href: "/login?role=admin",
    features: ["Institutional Analytics", "Multi-Section View", "Audit Trail", "Role Management"],
  },
];

// ── Capability bento items ────────────────────────────────────────

export default function Home() {
  const { user } = useUser();
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeRole, setActiveRole] = useState<string | null>(null);

  const router = useRouter();

  const handleRoleEnter = (href: string) => {
    router.push(href);
  };

  return (
    <div
      className="min-h-[100dvh] w-full"
      style={{ background: "#010102", color: "#f7f8f8", fontFamily: "var(--font-plus-jakarta-sans), system-ui, sans-serif" }}
    >
      {/* ── Floating Nav Island ─────────────────────────────────── */}
      <header className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-5 px-4">
        <motion.nav
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6, ease: [0.32, 0.72, 0, 1] }}
          className="flex items-center justify-between gap-6 px-5 h-12 rounded-full"
          style={{
            background: "rgba(15,16,17,0.88)",
            border: "1px solid #23252a",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            maxWidth: 780,
            width: "100%",
          }}
        >
          {/* Wordmark */}
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <span
              className="text-sm font-semibold tracking-tight"
              style={{ color: "#f7f8f8", letterSpacing: "-0.3px" }}
            >
              AI Sakhi
            </span>
          </Link>

          {/* Desktop nav links */}
          <div className="hidden md:flex items-center gap-1">
            {["Capabilities", "How It Works", "For Schools"].map((item) => (
              <button
                key={item}
                className="px-3 py-1.5 rounded-md text-sm transition-colors"
                style={{
                  color: "#8a8f98",
                  fontSize: 13,
                  background: "transparent",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#f7f8f8")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#8a8f98")}
              >
                {item}
              </button>
            ))}
          </div>

          {/* CTA pair */}
          <div className="flex items-center gap-2 shrink-0">
            {user ? (
              <Link
                href={getRoleLandingPage(user.role)}
                className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all"
                style={{ background: "#5e6ad2", color: "#fff", fontSize: 13 }}
              >
                Dashboard
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="hidden md:flex items-center px-3 py-1.5 rounded-md text-sm transition-colors"
                  style={{
                    background: "#0f1011",
                    color: "#f7f8f8",
                    border: "1px solid #23252a",
                    fontSize: 13,
                  }}
                >
                  Sign in
                </Link>
                <Link
                  href="/login"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium"
                  style={{ background: "#5e6ad2", color: "#fff", fontSize: 13 }}
                >
                  Get started
                  <span
                    className="w-5 h-5 rounded-full flex items-center justify-center"
                    style={{ background: "rgba(255,255,255,0.15)" }}
                  >
                    <CaretRight size={10} weight="bold" />
                  </span>
                </Link>
              </>
            )}

            {/* Mobile hamburger */}
            <button
              className="flex md:hidden items-center justify-center w-8 h-8 rounded-md"
              style={{ color: "#8a8f98" }}
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Toggle menu"
            >
              <AnimatePresence mode="wait">
                {menuOpen ? (
                  <motion.div key="x" initial={{ rotate: -45, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 45, opacity: 0 }} transition={{ duration: 0.2 }}>
                    <X size={18} />
                  </motion.div>
                ) : (
                  <motion.div key="menu" initial={{ rotate: 45, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -45, opacity: 0 }} transition={{ duration: 0.2 }}>
                    <List size={18} />
                  </motion.div>
                )}
              </AnimatePresence>
            </button>
          </div>
        </motion.nav>
      </header>

      {/* Mobile menu overlay */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 flex flex-col items-center justify-center"
            style={{ background: "rgba(1,1,2,0.96)", backdropFilter: "blur(24px)" }}
          >
            <div className="flex flex-col items-center gap-6">
              {["Capabilities", "How It Works", "For Schools", "Sign in", "Get started"].map(
                (item, i) => (
                  <motion.div
                    key={item}
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.05 * i, duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
                  >
                    <button
                      className="text-2xl font-semibold"
                      style={{ color: "#f7f8f8", letterSpacing: "-0.5px" }}
                      onClick={() => setMenuOpen(false)}
                    >
                      {item}
                    </button>
                  </motion.div>
                )
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── HERO — Editorial Split ──────────────────────────────── */}
      <section
        className="relative w-full min-h-[100dvh] flex flex-col lg:flex-row items-center"
        style={{ paddingTop: 80 }}
      >
        {/* Left: copy */}
        <div className="relative z-10 flex flex-col justify-center px-6 md:px-12 lg:px-16 xl:px-24 py-16 lg:py-0 lg:w-[52%] lg:min-h-[100dvh]">
          <motion.div
            initial={{ y: 32, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.8, ease: [0.32, 0.72, 0, 1], delay: 0.1 }}
          >
            {/* Status badge */}
            <div
              className="inline-flex items-center gap-2 rounded-full px-3 py-1 mb-8"
              style={{
                background: "#0f1011",
                border: "1px solid #23252a",
                fontSize: 11,
                color: "#8a8f98",
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                fontWeight: 500,
              }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: "#5e6ad2" }}
              />
              Free for students · CBSE & ICSE
            </div>

            {/* Display headline */}
            <h1
              className="font-bold leading-[1.05] mb-6"
              style={{
                fontSize: "clamp(2.5rem, 5vw, 4.5rem)",
                letterSpacing: "-2px",
                color: "#f7f8f8",
                maxWidth: "15ch",
              }}
            >
              Learn by{" "}
              <span style={{ color: "#5e6ad2" }}>asking</span>
              {", "}
              not memorising.
            </h1>

            {/* Subtext */}
            <p
              className="mb-10 leading-relaxed"
              style={{
                fontSize: "clamp(1rem, 1.8vw, 1.125rem)",
                color: "#8a8f98",
                maxWidth: "46ch",
              }}
            >
              AI Sakhi is an adaptive learning companion for KG–12 students.
              It never gives answers — it guides students to find them.
            </p>

            {/* CTA row */}
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/login"
                className="group flex items-center gap-2 px-5 py-3 rounded-lg font-medium transition-all active:scale-[0.98]"
                style={{
                  background: "#5e6ad2",
                  color: "#fff",
                  fontSize: 14,
                  transitionTimingFunction: SPRING,
                  transitionDuration: "400ms",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background = "#828fff";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = "#5e6ad2";
                }}
              >
                Start learning free
                <span
                  className="w-6 h-6 rounded-full flex items-center justify-center transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-[1px]"
                  style={{ background: "rgba(255,255,255,0.18)" }}
                >
                  <ArrowRight size={11} weight="bold" />
                </span>
              </Link>

              <Link
                href="/login?role=teacher"
                className="flex items-center gap-1.5 px-5 py-3 rounded-lg font-medium transition-colors"
                style={{
                  background: "#0f1011",
                  border: "1px solid #23252a",
                  color: "#f7f8f8",
                  fontSize: 14,
                }}
              >
                For Teachers
              </Link>
            </div>

            {/* Trust strip */}
            <div className="flex items-center gap-6 mt-12 flex-wrap">
              {[
                { n: "40+", label: "subjects covered" },
                { n: "KG–12", label: "all grades" },
                { n: "2 boards", label: "CBSE & ICSE" },
              ].map(({ n, label }) => (
                <div key={n} className="flex flex-col gap-0.5">
                  <span
                    className="text-xl font-bold"
                    style={{ letterSpacing: "-0.8px", color: "#f7f8f8" }}
                  >
                    {n}
                  </span>
                  <span style={{ fontSize: 12, color: "#62666d" }}>{label}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Right: hero image */}
        <motion.div
          className="relative lg:w-[48%] lg:min-h-[100dvh] flex items-center justify-center overflow-hidden"
          initial={{ opacity: 0, scale: 1.02 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.85, ease: [0.32, 0.72, 0, 1] }}
          style={{ minHeight: 360 }}
        >
          {/* Outer bezel shell */}
          <div
            className="relative w-full h-full"
            style={{ minHeight: "inherit" }}
          >
            <Image
              src="/hero-network.jpg"
              alt="Knowledge network visualization"
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover"
              priority
              style={{ opacity: 0.85 }}
            />
            {/* Left fade into canvas */}
            <div
              className="absolute inset-y-0 left-0 w-32 lg:w-48"
              style={{
                background: "linear-gradient(to right, #010102, transparent)",
              }}
            />
          </div>

          {/* Floating stat card — Double Bezel */}
          <motion.div
            initial={{ x: 24, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.7, ease: [0.32, 0.72, 0, 1] }}
            className="absolute bottom-12 right-6 lg:right-10"
            style={{
              padding: 6,
              background: "rgba(15,16,17,0.7)",
              border: "1px solid #23252a",
              borderRadius: 16,
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
            }}
          >
            <div
              className="flex flex-col gap-1 px-5 py-4"
              style={{
                background: "#0f1011",
                borderRadius: 11,
                border: "1px solid #1e2024",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)",
                minWidth: 180,
              }}
            >
              <span style={{ fontSize: 11, color: "#62666d", letterSpacing: "0.04em", textTransform: "uppercase" }}>
                Session cadence
              </span>
              <span
                className="font-bold"
                style={{ fontSize: 28, color: "#f7f8f8", letterSpacing: "-1px" }}
              >
                25 min
              </span>
              <span style={{ fontSize: 12, color: "#8a8f98" }}>
                Deep-focus Smart Sprint
              </span>
            </div>
          </motion.div>
        </motion.div>
      </section>

      {/* ── CAPABILITIES BENTO ─────────────────────────────────── */}
      <section className="w-full px-6 md:px-12 lg:px-16 xl:px-24 py-24 max-w-[1280px] mx-auto">
        <motion.div
          initial={{ y: 24, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7, ease: [0.32, 0.72, 0, 1] }}
        >
          <h2
            className="font-bold mb-3"
            style={{
              fontSize: "clamp(1.75rem, 3.5vw, 3rem)",
              letterSpacing: "-1.2px",
              color: "#f7f8f8",
            }}
          >
            Built on the science of how people actually learn.
          </h2>
          <p style={{ fontSize: 16, color: "#8a8f98", maxWidth: "52ch", marginBottom: "3rem" }}>
            Every feature is grounded in cognitive science research — not gamification gimmicks.
          </p>
        </motion.div>

        {/* Bento grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Large card 1 — Socratic Dialogue */}
          <motion.div
            initial={{ y: 24, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.6, ease: [0.32, 0.72, 0, 1], delay: 0 }}
            className="md:col-span-2"
          >
            {/* Double-Bezel outer shell */}
            <div
              style={{
                padding: 6,
                background: "#0c0c0d",
                border: "1px solid #23252a",
                borderRadius: 20,
              }}
            >
              <div
                style={{
                  background: "#0f1011",
                  borderRadius: 15,
                  border: "1px solid #1a1b1d",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
                  overflow: "hidden",
                  minHeight: 280,
                  position: "relative",
                }}
              >
                {/* Image background */}
                <div className="absolute inset-0">
                  <Image
                    src="/bento-feature.jpg"
                    alt="AI learning visualization"
                    fill
                    sizes="(max-width: 768px) 100vw, 66vw"
                    className="object-cover opacity-25"
                  />
                  <div
                    className="absolute inset-0"
                    style={{ background: "linear-gradient(135deg, rgba(94,106,210,0.08) 0%, transparent 60%)" }}
                  />
                </div>

                <div className="relative z-10 p-8">
                  <div className="flex items-center gap-2 mb-4">
                    <Brain size={16} style={{ color: "#5e6ad2" }} />
                    <span style={{ fontSize: 11, color: "#5e6ad2", letterSpacing: "0.04em", textTransform: "uppercase", fontWeight: 500 }}>
                      Core Method
                    </span>
                  </div>
                  <h3
                    className="font-semibold mb-3"
                    style={{ fontSize: 22, color: "#f7f8f8", letterSpacing: "-0.5px" }}
                  >
                    Socratic AI Dialogue
                  </h3>
                  <p style={{ fontSize: 14, color: "#8a8f98", maxWidth: "48ch", lineHeight: 1.6 }}>
                    Never gives the answer. Guides students through calibrated questions that
                    align precisely to their current zone of proximal development.
                  </p>

                  {/* Mini dialogue preview */}
                  <div className="mt-6 flex flex-col gap-2">
                    {[
                      { from: "student", msg: "Why does ice float on water?" },
                      { from: "ai", msg: "What do you know about the density of solid vs liquid water?" },
                      { from: "student", msg: "Ice is less dense because of hydrogen bonds?" },
                      { from: "ai", msg: "Exactly — what does that tell you about the arrangement of molecules?" },
                    ].map((line, i) => (
                      <div
                        key={i}
                        className={`flex ${line.from === "ai" ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          style={{
                            padding: "6px 12px",
                            borderRadius: line.from === "ai" ? "12px 12px 4px 12px" : "12px 12px 12px 4px",
                            background: line.from === "ai" ? "rgba(94,106,210,0.15)" : "rgba(255,255,255,0.05)",
                            border: line.from === "ai" ? "1px solid rgba(94,106,210,0.25)" : "1px solid #23252a",
                            fontSize: 12,
                            color: line.from === "ai" ? "#d0d6e0" : "#8a8f98",
                            maxWidth: "30ch",
                          }}
                        >
                          {line.msg}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Small card 1 — Smart Sprint */}
          <motion.div
            initial={{ y: 24, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.6, ease: [0.32, 0.72, 0, 1], delay: 0.08 }}
          >
            <div
              style={{
                padding: 6,
                background: "#0c0c0d",
                border: "1px solid #23252a",
                borderRadius: 20,
                height: "100%",
              }}
            >
              <div
                style={{
                  background: "#0f1011",
                  borderRadius: 15,
                  border: "1px solid #1a1b1d",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
                  padding: "2rem",
                  height: "100%",
                  minHeight: 280,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <Timer size={16} style={{ color: "#5e6ad2" }} />
                    <span style={{ fontSize: 11, color: "#5e6ad2", letterSpacing: "0.04em", textTransform: "uppercase", fontWeight: 500 }}>
                      Focus Sessions
                    </span>
                  </div>
                  <h3
                    className="font-semibold mb-3"
                    style={{ fontSize: 20, color: "#f7f8f8", letterSpacing: "-0.4px" }}
                  >
                    25-min Smart Sprint
                  </h3>
                  <p style={{ fontSize: 14, color: "#8a8f98", lineHeight: 1.6 }}>
                    Pomodoro-anchored deep-work sessions with adaptive difficulty that ratchets as mastery builds.
                  </p>
                </div>

                {/* Timer visual */}
                <div
                  className="mt-6 flex items-center justify-center"
                  style={{
                    height: 80,
                    borderRadius: 12,
                    background: "rgba(94,106,210,0.06)",
                    border: "1px solid rgba(94,106,210,0.12)",
                  }}
                >
                  <span
                    className="font-bold"
                    style={{ fontSize: 32, letterSpacing: "-2px", color: "#5e6ad2", fontVariantNumeric: "tabular-nums" }}
                  >
                    24:07
                  </span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Small card 2 — SM-2 Spaced Recall */}
          <motion.div
            initial={{ y: 24, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.6, ease: [0.32, 0.72, 0, 1], delay: 0.12 }}
          >
            <div
              style={{
                padding: 6,
                background: "#0c0c0d",
                border: "1px solid #23252a",
                borderRadius: 20,
                height: "100%",
              }}
            >
              <div
                style={{
                  background: "#0f1011",
                  borderRadius: 15,
                  border: "1px solid #1a1b1d",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
                  padding: "2rem",
                  height: "100%",
                  minHeight: 200,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
            >
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <ArrowsCounterClockwise size={16} style={{ color: "#5e6ad2" }} />
                    <span style={{ fontSize: 11, color: "#5e6ad2", letterSpacing: "0.04em", textTransform: "uppercase", fontWeight: 500 }}>
                      Retention Science
                    </span>
                  </div>
                  <h3
                    className="font-semibold mb-3"
                    style={{ fontSize: 20, color: "#f7f8f8", letterSpacing: "-0.4px" }}
                  >
                    SM-2 Spaced Recall
                  </h3>
                  <p style={{ fontSize: 14, color: "#8a8f98", lineHeight: 1.6 }}>
                    Reviews scheduled at scientifically optimal intervals to move concepts to long-term memory.
                  </p>
                </div>

                <div className="mt-4 flex gap-1.5 flex-wrap">
                  {["Day 1", "Day 3", "Day 8", "Day 21", "Day 55"].map((d, i) => (
                    <span
                      key={d}
                      style={{
                        fontSize: 11,
                        padding: "3px 8px",
                        borderRadius: 99,
                        background: i < 3 ? "rgba(94,106,210,0.15)" : "rgba(255,255,255,0.04)",
                        border: i < 3 ? "1px solid rgba(94,106,210,0.25)" : "1px solid #23252a",
                        color: i < 3 ? "#828fff" : "#62666d",
                      }}
                    >
                      {d}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>

          {/* Large card 2 — Misconception Graph */}
          <motion.div
            initial={{ y: 24, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.6, ease: [0.32, 0.72, 0, 1], delay: 0.16 }}
            className="md:col-span-2"
          >
            <div
              style={{
                padding: 6,
                background: "#0c0c0d",
                border: "1px solid #23252a",
                borderRadius: 20,
              }}
            >
              <div
                style={{
                  background: "#0f1011",
                  borderRadius: 15,
                  border: "1px solid #1a1b1d",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
                  padding: "2rem",
                  minHeight: 200,
                }}
              >
                <div className="flex items-center gap-2 mb-4">
                  <ChartLineUp size={16} style={{ color: "#5e6ad2" }} />
                  <span style={{ fontSize: 11, color: "#5e6ad2", letterSpacing: "0.04em", textTransform: "uppercase", fontWeight: 500 }}>
                    Precision Analytics
                  </span>
                </div>
                <h3
                  className="font-semibold mb-3"
                  style={{ fontSize: 20, color: "#f7f8f8", letterSpacing: "-0.4px" }}
                >
                  Misconception Graph
                </h3>
                <p style={{ fontSize: 14, color: "#8a8f98", maxWidth: "52ch", lineHeight: 1.6 }}>
                  Builds a live map of each student&apos;s conceptual gaps across subjects and surfaces them to both student and teacher for targeted interventions.
                </p>

                {/* Mini bar chart */}
                <div className="mt-6 flex items-end gap-2" style={{ height: 60 }}>
                  {[
                    { label: "Algebra", h: 85, gap: false },
                    { label: "Optics", h: 42, gap: true },
                    { label: "Vectors", h: 70, gap: false },
                    { label: "Thermo", h: 28, gap: true },
                    { label: "Calculus", h: 60, gap: false },
                    { label: "Chemistry", h: 35, gap: true },
                  ].map(({ label, h, gap }) => (
                    <div key={label} className="flex flex-col items-center gap-1 flex-1">
                      <div
                        style={{
                          width: "100%",
                          height: `${h}%`,
                          borderRadius: "4px 4px 2px 2px",
                          background: gap
                            ? "rgba(94,106,210,0.35)"
                            : "rgba(94,106,210,0.12)",
                          border: gap ? "1px solid rgba(94,106,210,0.4)" : "1px solid rgba(94,106,210,0.15)",
                          transition: "all 0.3s",
                        }}
                      />
                      <span style={{ fontSize: 9, color: "#62666d", whiteSpace: "nowrap" }}>
                        {label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── ROLE PORTALS ───────────────────────────────────────── */}
      <section className="w-full px-6 md:px-12 lg:px-16 xl:px-24 py-24 max-w-[1280px] mx-auto">
        <motion.div
          initial={{ y: 24, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7, ease: [0.32, 0.72, 0, 1] }}
          className="mb-12"
        >
          <h2
            className="font-bold mb-3"
            style={{
              fontSize: "clamp(1.75rem, 3.5vw, 3rem)",
              letterSpacing: "-1.2px",
              color: "#f7f8f8",
            }}
          >
            One platform, four roles.
          </h2>
          <p style={{ fontSize: 16, color: "#8a8f98", maxWidth: "44ch" }}>
            Each role gets a dedicated workspace tuned to their specific job-to-be-done.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {ROLES.map((role, i) => {
            const Icon = role.icon;
            const isActive = activeRole === role.id;
            return (
              <motion.div
                key={role.id}
                initial={{ y: 24, opacity: 0 }}
                whileInView={{ y: 0, opacity: 1 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.55, ease: [0.32, 0.72, 0, 1], delay: i * 0.07 }}
                onHoverStart={() => setActiveRole(role.id)}
                onHoverEnd={() => setActiveRole(null)}
              >
                {/* Double-Bezel card */}
                <div
                  style={{
                    padding: 5,
                    background: isActive ? "rgba(94,106,210,0.08)" : "#0c0c0d",
                    border: isActive ? "1px solid rgba(94,106,210,0.3)" : "1px solid #23252a",
                    borderRadius: 18,
                    transition: `all 500ms ${SPRING}`,
                    cursor: "pointer",
                  }}
                  onClick={() => handleRoleEnter(role.href)}
                >
                  <div
                    style={{
                      background: isActive ? "#111218" : "#0f1011",
                      borderRadius: 14,
                      border: "1px solid #1a1b1d",
                      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
                      padding: "1.5rem",
                      display: "flex",
                      flexDirection: "column",
                      gap: "1rem",
                      minHeight: 240,
                      transition: `all 500ms ${SPRING}`,
                    }}
                  >
                    {/* Icon */}
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 10,
                        background: isActive ? "rgba(94,106,210,0.15)" : "rgba(255,255,255,0.04)",
                        border: isActive ? "1px solid rgba(94,106,210,0.25)" : "1px solid #23252a",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        transition: `all 400ms ${SPRING}`,
                      }}
                    >
                      <Icon
                        size={20}
                        weight="light"
                        style={{ color: isActive ? "#5e6ad2" : "#8a8f98" }}
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <span
                          className="font-semibold"
                          style={{ fontSize: 16, color: "#f7f8f8", letterSpacing: "-0.3px" }}
                        >
                          {role.label}
                        </span>
                        <ArrowRight
                          size={14}
                          style={{
                            color: isActive ? "#5e6ad2" : "#62666d",
                            transform: isActive ? "translateX(2px) translateY(-1px)" : "none",
                            transition: `all 300ms ${SPRING}`,
                          }}
                        />
                      </div>
                      <span
                        style={{
                          fontSize: 11,
                          color: isActive ? "#5e6ad2" : "#62666d",
                          letterSpacing: "0.03em",
                          transition: "color 300ms",
                        }}
                      >
                        {role.subtitle}
                      </span>
                    </div>

                    <p style={{ fontSize: 13, color: "#8a8f98", lineHeight: 1.55 }}>
                      {role.tagline}
                    </p>

                    <div className="flex flex-col gap-1.5 mt-auto">
                      {role.features.map((feat) => (
                        <div key={feat} className="flex items-center gap-2">
                          <div
                            style={{
                              width: 4,
                              height: 4,
                              borderRadius: "50%",
                              background: isActive ? "#5e6ad2" : "#23252a",
                              border: isActive ? "none" : "1px solid #3e3e44",
                              flexShrink: 0,
                              transition: "background 300ms",
                            }}
                          />
                          <span style={{ fontSize: 12, color: "#62666d" }}>{feat}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* ── STUDENT PORTRAIT — Z-Axis editorial break ──────────── */}
      <section className="w-full px-6 md:px-12 lg:px-16 xl:px-24 py-24 max-w-[1280px] mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Portrait image — Double Bezel */}
          <motion.div
            initial={{ x: -24, opacity: 0 }}
            whileInView={{ x: 0, opacity: 1 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.8, ease: [0.32, 0.72, 0, 1] }}
            style={{
              padding: 6,
              background: "#0c0c0d",
              border: "1px solid #23252a",
              borderRadius: 24,
            }}
          >
            <div
              style={{
                borderRadius: 19,
                overflow: "hidden",
                border: "1px solid #1a1b1d",
                aspectRatio: "4/3",
                position: "relative",
              }}
            >
              <Image
                src="/student-portrait.jpg"
                alt="Student learning with AI Sakhi"
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover"
              />
              {/* Subtle lavender tint overlay */}
              <div
                className="absolute inset-0"
                style={{
                  background: "linear-gradient(to top right, rgba(94,106,210,0.08) 0%, transparent 60%)",
                }}
              />
            </div>
          </motion.div>

          {/* Copy */}
          <motion.div
            initial={{ x: 24, opacity: 0 }}
            whileInView={{ x: 0, opacity: 1 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.8, ease: [0.32, 0.72, 0, 1], delay: 0.1 }}
            className="flex flex-col gap-6"
          >
            <h2
              className="font-bold"
              style={{
                fontSize: "clamp(1.75rem, 3.5vw, 2.75rem)",
                letterSpacing: "-1.2px",
                color: "#f7f8f8",
              }}
            >
              The student does the thinking.
              <br />
              <span style={{ color: "#5e6ad2" }}>The AI holds the map.</span>
            </h2>

            <p style={{ fontSize: 16, color: "#8a8f98", lineHeight: 1.7, maxWidth: "46ch" }}>
              Traditional tutoring apps just explain concepts. AI Sakhi asks questions that force
              students to construct understanding from the ground up — the only kind that sticks.
            </p>

            <div className="flex flex-col gap-4">
              {[
                {
                  icon: Sparkle,
                  title: "Adaptive question depth",
                  body: "Questions calibrate to the student's demonstrated understanding in real time.",
                },
                {
                  icon: BookOpenText,
                  title: "Curriculum-anchored",
                  body: "All guidance maps to CBSE and ICSE syllabi across 40+ subjects.",
                },
              ].map(({ icon: Icon, title, body }) => (
                <div key={title} className="flex gap-4">
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 9,
                      background: "rgba(94,106,210,0.1)",
                      border: "1px solid rgba(94,106,210,0.2)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      marginTop: 2,
                    }}
                  >
                    <Icon size={16} weight="light" style={{ color: "#5e6ad2" }} />
                  </div>
                  <div>
                    <div
                      className="font-medium mb-1"
                      style={{ fontSize: 14, color: "#f7f8f8", letterSpacing: "-0.2px" }}
                    >
                      {title}
                    </div>
                    <div style={{ fontSize: 13, color: "#8a8f98", lineHeight: 1.5 }}>{body}</div>
                  </div>
                </div>
              ))}
            </div>

            <Link
              href="/login"
              className="group inline-flex items-center gap-2 px-5 py-3 rounded-lg font-medium w-fit transition-all active:scale-[0.98]"
              style={{
                background: "#5e6ad2",
                color: "#fff",
                fontSize: 14,
                transitionTimingFunction: SPRING,
                transitionDuration: "400ms",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#828fff"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "#5e6ad2"; }}
            >
              Try it yourself
              <span
                className="w-6 h-6 rounded-full flex items-center justify-center transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-[1px]"
                style={{ background: "rgba(255,255,255,0.18)" }}
              >
                <ArrowRight size={11} weight="bold" />
              </span>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ── CTA BANNER ─────────────────────────────────────────── */}
      <section className="w-full px-6 md:px-12 lg:px-16 xl:px-24 py-16 pb-24 max-w-[1280px] mx-auto">
        <motion.div
          initial={{ y: 24, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.7, ease: [0.32, 0.72, 0, 1] }}
          style={{
            padding: 6,
            background: "#0c0c0d",
            border: "1px solid #23252a",
            borderRadius: 24,
          }}
        >
          <div
            style={{
              background: "#0f1011",
              borderRadius: 19,
              border: "1px solid #1a1b1d",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
              padding: "3rem 2.5rem",
              display: "flex",
              flexDirection: "column",
              gap: "1.5rem",
              position: "relative",
              overflow: "hidden",
            }}
          >
            {/* Background radial accent */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: "radial-gradient(ellipse 60% 80% at 80% 50%, rgba(94,106,210,0.06) 0%, transparent 70%)",
              }}
            />

            <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <div>
                <h2
                  className="font-bold mb-2"
                  style={{
                    fontSize: "clamp(1.5rem, 3vw, 2.25rem)",
                    letterSpacing: "-0.8px",
                    color: "#f7f8f8",
                  }}
                >
                  Start learning today.
                  <br />
                  Free for all students.
                </h2>
                <p style={{ fontSize: 15, color: "#8a8f98" }}>
                  No subscription. No credit card. Just better learning.
                </p>
              </div>

              <div className="flex flex-wrap gap-3 shrink-0">
                <Link
                  href="/login"
                  className="group flex items-center gap-2 px-6 py-3 rounded-lg font-medium whitespace-nowrap transition-all active:scale-[0.98]"
                  style={{
                    background: "#5e6ad2",
                    color: "#fff",
                    fontSize: 14,
                    transitionTimingFunction: SPRING,
                    transitionDuration: "400ms",
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#828fff"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "#5e6ad2"; }}
                >
                  Create free account
                  <span
                    className="w-6 h-6 rounded-full flex items-center justify-center transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-[1px]"
                    style={{ background: "rgba(255,255,255,0.18)" }}
                  >
                    <ArrowRight size={11} weight="bold" />
                  </span>
                </Link>
                <Link
                  href="/login?role=teacher"
                  className="flex items-center gap-1.5 px-6 py-3 rounded-lg font-medium whitespace-nowrap"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid #23252a",
                    color: "#f7f8f8",
                    fontSize: 14,
                  }}
                >
                  School & Teacher portal
                </Link>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ── FOOTER ─────────────────────────────────────────────── */}
      <footer
        className="w-full px-6 md:px-12 lg:px-16 xl:px-24 py-12"
        style={{ borderTop: "1px solid #141516" }}
      >
        <div className="max-w-[1280px] mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <div
              className="font-semibold mb-1"
              style={{ fontSize: 14, color: "#f7f8f8", letterSpacing: "-0.3px" }}
            >
              AI Sakhi
            </div>
            <div style={{ fontSize: 12, color: "#62666d" }}>
              Adaptive learning for KG–12 · CBSE & ICSE
            </div>
          </div>

          <div className="flex flex-wrap gap-6">
            {["Privacy", "Terms", "GitHub", "Contact"].map((item) => (
              <a
                key={item}
                href="#"
                style={{ fontSize: 12, color: "#62666d" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#f7f8f8"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "#62666d"; }}
              >
                {item}
              </a>
            ))}
          </div>

          <div style={{ fontSize: 11, color: "#3e3e44" }}>
            © 2025 AI Sakhi. Built for India.
          </div>
        </div>
      </footer>
    </div>
  );
}
