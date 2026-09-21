"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useUser } from "@/lib/user-context";
import { getRoleLandingPage } from "@/lib/auth";

const ThreeKnowledgeOrb = dynamic(
  () => import("@/components/ThreeKnowledgeOrb"),
  {
    ssr: false,
    loading: () => (
      <div
        className="w-full h-full flex items-center justify-center select-none"
        style={{ minHeight: 340 }}
      >
        <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-emerald-500/20 via-teal-400/20 to-emerald-300/10 blur-xl animate-pulse flex items-center justify-center">
          <span className="text-3xl select-none">🌸</span>
        </div>
      </div>
    ),
  }
);

import {
  GraduationCap,
  BookOpen,
  Users,
  ShieldCheck,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  Zap,
  Clock,
  ChevronRight,
  BrainCircuit,
  MessageSquare,
  Award,
} from "lucide-react";

// ── Role Gateway Definitions ──────────────────────────
const ROLES = [
  {
    id: "student",
    label: "Student Companion",
    role: "student",
    tagline: "Master concepts through patient Socratic dialogue & 25-minute Smart Sprints.",
    icon: GraduationCap,
    accent: "#10b981",
    glow: "rgba(16, 185, 129, 0.15)",
    border: "rgba(16, 185, 129, 0.3)",
    badge: "KG – Class 12",
    features: [
      "Patient Socratic guidance",
      "25-min Smart Sprints",
      "SM-2 Spaced Recall",
      "Misconception Pinpointing",
    ],
  },
  {
    id: "teacher",
    label: "Teacher Workspace",
    role: "teacher",
    tagline: "Curriculum question bank & verified classroom analytics for targeted interventions.",
    icon: BookOpen,
    accent: "#8b5cf6",
    glow: "rgba(139, 92, 246, 0.15)",
    border: "rgba(139, 92, 246, 0.3)",
    badge: "CBSE & ICSE",
    features: [
      "Curriculum question forge",
      "Submission batch review",
      "Targeted intervention signals",
      "Learning outcome mapping",
    ],
  },
  {
    id: "parent",
    label: "Guardian Digest",
    role: "parent",
    tagline: "Weekly celebration insights & tailored conversation starters without data overwhelm.",
    icon: Users,
    accent: "#f59e0b",
    glow: "rgba(245, 158, 11, 0.15)",
    border: "rgba(245, 158, 11, 0.3)",
    badge: "Positive AI",
    features: [
      "Weekly celebration wins",
      "Priority focus areas",
      "Dinner table conversation starter",
      "Study time audit",
    ],
  },
  {
    id: "admin",
    label: "School Governance",
    role: "admin",
    tagline: "Tenant isolation, role-based safety gates, and deterministic audit trails.",
    icon: ShieldCheck,
    accent: "#f43f5e",
    glow: "rgba(244, 63, 94, 0.15)",
    border: "rgba(244, 63, 94, 0.3)",
    badge: "Enterprise",
    features: [
      "Tenant safety isolation",
      "Real-time safety events audit",
      "Bulk export workflows",
      "Pedagogy eval metrics",
    ],
  },
];

// ── Interactive Socratic Studio Data ───────────────────
const STUDIO_PROBLEMS = [
  {
    id: 0,
    subject: "Class 10 Mathematics",
    topic: "Quadratic Equations",
    question: "Find the roots of 2x² + 5x - 3 = 0 using factorization.",
    ncertSource: "NCERT Class 10 Mathematics · Chapter 4, Page 78",
    steps: [
      {
        title: "Initial Problem Statement",
        body: "Equation: 2x² + 5x - 3 = 0. We need two numbers whose product is (2 × -3) = -6, and whose sum is +5.",
        type: "statement",
      },
      {
        title: "Socratic Hint",
        body: "Look at the factors of -6. Which pair sums to +5? Consider +6 and -1. How can we split the middle term 5x using these two values?",
        type: "hint",
      },
      {
        title: "Step-by-Step Derivation",
        body: "Split 5x into 6x - x:\n2x² + 6x - x - 3 = 0\nFactor by grouping: 2x(x + 3) - 1(x + 3) = 0\n(2x - 1)(x + 3) = 0\nRoots: x = 1/2 or x = -3.",
        type: "derivation",
      },
      {
        title: "Misconception Radar Pinpointed",
        body: "Common student trap: forgetting that factoring requires splitting ac (-6), not just c (-3). Sakhi flags this before incorrect signs compound.",
        type: "misconception",
      },
    ],
  },
  {
    id: 1,
    subject: "Class 8 Science",
    topic: "Cell Structure & Photosynthesis",
    question: "Why do plant cells have chloroplasts and large central vacuoles while animal cells do not?",
    ncertSource: "NCERT Class 8 Science · Chapter 8 (Cell Structure & Functions), Page 94",
    steps: [
      {
        title: "Initial Problem Statement",
        body: "Plant and animal cells share basic organelles, but plants require distinct cellular adaptations for autotrophic nutrition and structural turgidity.",
        type: "statement",
      },
      {
        title: "Socratic Hint",
        body: "Unlike animals that can move to find food or shade, plants are stationary autotrophs. What organelle synthesizes glucose from sunlight? And how does internal water pressure help a green stem stand upright?",
        type: "hint",
      },
      {
        title: "Step-by-Step Derivation",
        body: "1. Chloroplasts contain chlorophyll pigments that synthesize glucose via photophosphorylation.\n2. The large central vacuole maintains turgor pressure against the cell wall, allowing herbaceous plants to stand erect without an animal skeleton.",
        type: "derivation",
      },
      {
        title: "Misconception Radar Pinpointed",
        body: "Misconception: 'Plant cells only do photosynthesis and never cellular respiration'. Sakhi clarifies that plant cells also use mitochondria for ATP respiration.",
        type: "misconception",
      },
    ],
  },
  {
    id: 2,
    subject: "Class 12 Physics",
    topic: "Electrostatics & Gauss's Law",
    question: "Calculate the electric field at a distance r from an infinitely long straight wire carrying uniform linear charge density λ.",
    ncertSource: "NCERT Class 12 Physics · Chapter 1 (Electric Charges and Fields), Page 37",
    steps: [
      {
        title: "Initial Problem Statement",
        body: "An infinite straight wire carries linear charge density λ. We want to find the radial electric field E at radial distance r using Gauss's Law.",
        type: "statement",
      },
      {
        title: "Socratic Hint",
        body: "Consider cylindrical symmetry. What Gaussian surface mirrors the wire's geometry? In what direction do electric field lines radiate from the wire?",
        type: "hint",
      },
      {
        title: "Step-by-Step Derivation",
        body: "Choose a coaxial Gaussian cylinder of radius r and length L.\nTotal flux Φ = E × (2πrL)\nEnclosed charge q_in = λL\nBy Gauss's Law: E(2πrL) = λL / ε₀\nE = λ / (2πε₀r) ̂r",
        type: "derivation",
      },
      {
        title: "Misconception Radar Pinpointed",
        body: "Trap alert: Integrating over planar ends. Because electric field is purely radial, the dot product E · dA on flat ends is 0 (cos 90° = 0).",
        type: "misconception",
      },
    ],
  },
];

// ── Smart Sprint Timeline Stages ───────────────────────
const SPRINT_STAGES = [
  {
    phase: "Warmup (5 min)",
    role: "Confidence Activation",
    desc: "2 rapid diagnostic questions targeted at prerequisites. Calibrates student cognitive readiness before new challenges.",
    color: "#10b981",
  },
  {
    phase: "Deep Practice (15 min)",
    role: "Socratic Challenge",
    desc: "Adaptive problem-solving where AI Sakhi nudges with progressive hints instead of spoiling answers.",
    color: "#06b6d4",
  },
  {
    phase: "Recall (5 min)",
    role: "SM-2 Memory Consolidation",
    desc: "Active recall flashcards scheduled via spaced repetition to guarantee textbook concepts enter long-term memory.",
    color: "#f59e0b",
  },
];

// ── Grade Spectrum Bands ───────────────────────────────
const GRADE_BANDS = [
  {
    title: "Foundational (KG – Class 5)",
    accent: "#10b981",
    subtitle: "Story-Driven Curiosity",
    quote: "“Imagine numbers as friendly squirrels gathering acorns! Let's count how many we have left when 3 run up the mango tree.”",
    detail: "Gentle encouragement, visual metaphors, and zero academic anxiety.",
  },
  {
    title: "Middle School (Class 6 – 8)",
    accent: "#6366f1",
    subtitle: "Socratic Inquiry",
    quote: "“Before we apply the formula, look at this beaker diagram. What happens to the water level when the stone is immersed?”",
    detail: "NCERT textbook chapter attribution, concept maps, and interactive hypothesis testing.",
  },
  {
    title: "Secondary & Senior (Class 9 – 12)",
    accent: "#f59e0b",
    subtitle: "Rigorous CBSE & Competitive Mastery",
    quote: "“Let's analyze the free-body diagram along the inclined plane. Notice how normal force adjusts when friction reaches its static threshold.”",
    detail: "Mathematical derivations, step-by-step proofs, and targeted exam problem sets.",
  },
];

export default function Home() {
  const router = useRouter();
  const { user, isReady } = useUser();

  // Studio Interactive State
  const [activeTab, setActiveTab] = useState<"student" | "sprint" | "teacher" | "parent">("student");
  const [activeProblemIdx, setActiveProblemIdx] = useState(0);
  const [activeStepIdx, setActiveStepIdx] = useState(0);

  // Sprint Interactive State
  const [activeSprintIdx, setActiveSprintIdx] = useState(1);

  // Grade Band State
  const [activeGradeBand, setActiveGradeBand] = useState(1);

  useEffect(() => {
    if (!isReady) return;
    if (user) {
      router.replace(getRoleLandingPage(user.role));
    }
  }, [isReady, router, user]);

  const currentProblem = STUDIO_PROBLEMS[activeProblemIdx];
  const currentStep = currentProblem.steps[activeStepIdx];

  return (
    <div className="min-h-screen bg-[#030712] text-neutral-100 flex flex-col items-center selection:bg-emerald-500/30 selection:text-emerald-200 overflow-x-hidden relative">
      
      {/* ── Ambient Radial Atmosphere ── */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-gradient-to-b from-emerald-600/12 via-teal-500/8 to-transparent rounded-full blur-[140px]" />
        <div className="absolute top-[40%] left-[-15%] w-[600px] h-[600px] bg-indigo-600/8 rounded-full blur-[160px]" />
        <div className="absolute top-[70%] right-[-15%] w-[650px] h-[650px] bg-emerald-600/8 rounded-full blur-[170px]" />
      </div>

      {/* ── 1. Fluid Floating Island Navigation ── */}
      <header className="fluid-nav-pill">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/25 ring-1 ring-white/20 flex-shrink-0">
            <span className="text-base select-none">🌸</span>
          </div>
          <div>
            <span className="text-base font-extrabold tracking-tight text-white block leading-none">AI Sakhi</span>
            <span className="text-[10px] font-semibold text-emerald-400 uppercase tracking-widest">Adaptive Learning</span>
          </div>
        </div>

        <nav className="hidden md:flex items-center gap-8 text-xs font-semibold text-neutral-300">
          <a href="#studio" className="hover:text-white transition-colors">Live Studio</a>
          <a href="#sprints" className="hover:text-white transition-colors">Smart Sprints</a>
          <a href="#grades" className="hover:text-white transition-colors">Curriculum Bands</a>
          <a href="#roles" className="hover:text-white transition-colors">Role Workspaces</a>
          <Link href="/demo" className="hover:text-emerald-400 transition-colors flex items-center gap-1">
            <span>Tour</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/login?role=student")}
            className="btn-island primary"
          >
            <span>Sign In</span>
            <span className="btn-disc">
              <ArrowRight size={14} className="text-white" />
            </span>
          </button>
        </div>
      </header>

      {/* ── 2. Cinematic Center-Staged Hero ── */}
      <section className="site-container relative z-10 pt-28 sm:pt-36 pb-16 text-center flex flex-col items-center">
        
        {/* Micro Eyebrow Badge */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.32, 0.72, 0, 1] }}
          className="mb-6"
        >
          <span className="shimmer-pill">
            <Sparkles size={13} className="text-emerald-400 animate-pulse" />
            Evidence-Grounded NCERT Learning Companion
          </span>
        </motion.div>

        {/* Master Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1, ease: [0.32, 0.72, 0, 1] }}
          className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white max-w-4xl mx-auto leading-[1.08]"
        >
          Transforming academic anxiety into{" "}
          <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-300 bg-clip-text text-transparent">
            textbook mastery.
          </span>
        </motion.h1>

        {/* Spacious Body Copy */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2, ease: [0.32, 0.72, 0, 1] }}
          className="mt-6 text-base sm:text-xl text-neutral-400 max-w-2xl mx-auto font-normal leading-relaxed"
        >
          Not a generic cheat-bot. AI Sakhi is a patient, curriculum-anchored Socratic tutor that pinpoints misconceptions, choreographs 25-minute Smart Sprints, and unites students, teachers, and guardians in one loop.
        </motion.p>

        {/* Action Controls */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3, ease: [0.32, 0.72, 0, 1] }}
          className="mt-8 flex flex-wrap items-center justify-center gap-4"
        >
          <button
            onClick={() => router.push("/login?role=student")}
            className="btn-island primary shadow-lg shadow-emerald-500/20"
          >
            <span>Start Socratic Learning</span>
            <span className="btn-disc">
              <ArrowRight size={14} className="text-white" />
            </span>
          </button>

          <a
            href="#studio"
            className="btn-island secondary"
          >
            <span>Explore Live Studio ↓</span>
            <span className="btn-disc bg-white/10">
              <Zap size={14} className="text-emerald-400" />
            </span>
          </a>
        </motion.div>

        {/* ── Uncaged Floating 3D Knowledge Orb Stage ── */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, delay: 0.25, ease: [0.32, 0.72, 0, 1] }}
          className="relative w-full max-w-[560px] aspect-square mx-auto mt-10"
        >
          {/* Ambient Glow Aura */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-emerald-500/20 via-teal-500/15 to-indigo-500/10 blur-3xl pointer-events-none" />

          {/* Procedural Canvas (Zero Border Cage) */}
          <div className="relative w-full h-full">
            <ThreeKnowledgeOrb className="w-full h-full" />
          </div>

          {/* Minimal Floating Status Pill */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 px-4 py-1.5 rounded-full bg-[#0a0f18]/80 border border-white/10 backdrop-blur-md text-[11px] font-semibold text-neutral-300 flex items-center gap-2 shadow-xl">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>Interactive 3D Curriculum Engine · Drag to Orbit</span>
          </div>
        </motion.div>

        {/* Trust Metrics Strip */}
        <div className="w-full max-w-4xl mx-auto mt-12 pt-8 border-t border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
          <div>
            <div className="text-2xl sm:text-3xl font-black text-white">54+</div>
            <div className="text-xs font-bold text-emerald-400 uppercase tracking-wider mt-0.5">NCERT Subjects</div>
            <div className="text-[11px] text-neutral-400">Class 6–12 CBSE mapped</div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black text-white">100%</div>
            <div className="text-xs font-bold text-emerald-400 uppercase tracking-wider mt-0.5">Safety Release Gate</div>
            <div className="text-[11px] text-neutral-400">Deterministic eval benchmark</div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black text-white">KaTeX</div>
            <div className="text-xs font-bold text-emerald-400 uppercase tracking-wider mt-0.5">STEM Engine</div>
            <div className="text-[11px] text-neutral-400">Textbook formula precision</div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black text-white">SM-2</div>
            <div className="text-xs font-bold text-emerald-400 uppercase tracking-wider mt-0.5">Spaced Retention</div>
            <div className="text-[11px] text-neutral-400">Memory recall science</div>
          </div>
        </div>

      </section>

      {/* ── 3. The Live Interactive Socratic Studio ── */}
      <section id="studio" className="site-container relative z-10 py-24 sm:py-32 w-full">
        <div className="text-center max-w-2xl mx-auto mb-14 space-y-3">
          <span className="shimmer-pill">Interactive Live Sandbox</span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white">
            Experience how AI Sakhi teaches
          </h2>
          <p className="text-sm sm:text-base text-neutral-400">
            Test the real pedagogical engines in action. Toggle modes and click steps to see real-time adaptive responses.
          </p>
        </div>

        {/* Studio Interactive Container */}
        <div className="studio-surface max-w-4xl mx-auto p-6 sm:p-8">
          
          {/* Top Bar: Mode Switcher Tabs */}
          <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-white/10">
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => { setActiveTab("student"); setActiveStepIdx(0); }}
                className={`studio-tab-btn ${activeTab === "student" ? "active" : ""}`}
              >
                <BrainCircuit size={15} />
                <span>Student Socratic Mode</span>
              </button>
              <button
                onClick={() => setActiveTab("sprint")}
                className={`studio-tab-btn ${activeTab === "sprint" ? "active" : ""}`}
              >
                <Clock size={15} />
                <span>Daily Smart Sprint</span>
              </button>
              <button
                onClick={() => setActiveTab("teacher")}
                className={`studio-tab-btn ${activeTab === "teacher" ? "active" : ""}`}
              >
                <BookOpen size={15} />
                <span>Teacher Forge</span>
              </button>
              <button
                onClick={() => setActiveTab("parent")}
                className={`studio-tab-btn ${activeTab === "parent" ? "active" : ""}`}
              >
                <Users size={15} />
                <span>Guardian Pulse</span>
              </button>
            </div>

            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Live Engine Ready</span>
            </div>
          </div>

          {/* ── Mode 1: Student Socratic Sandbox ── */}
          {activeTab === "student" && (
            <div className="pt-6 space-y-6">
              
              {/* Subject Selectors */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider mr-2">Subject:</span>
                {STUDIO_PROBLEMS.map((prob, idx) => (
                  <button
                    key={prob.id}
                    onClick={() => { setActiveProblemIdx(idx); setActiveStepIdx(0); }}
                    className={`subject-chip ${activeProblemIdx === idx ? "active" : ""}`}
                  >
                    {prob.subject} · {prob.topic}
                  </button>
                ))}
              </div>

              {/* Problem Prompt Box */}
              <div className="p-5 rounded-2xl bg-[#090d16] border border-white/5 space-y-2">
                <div className="flex items-center justify-between text-xs text-neutral-400">
                  <span className="font-semibold text-emerald-400">Curriculum Challenge</span>
                  <span className="text-[11px] font-mono">{currentProblem.ncertSource}</span>
                </div>
                <div className="text-lg font-bold text-white leading-relaxed">
                  {currentProblem.question}
                </div>
              </div>

              {/* Socratic Step Interaction Controller */}
              <div className="space-y-4">
                <div className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
                  Select Pedagogical Step to Simulate:
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {currentProblem.steps.map((step, idx) => (
                    <button
                      key={idx}
                      onClick={() => setActiveStepIdx(idx)}
                      className={`p-3 rounded-xl text-left border transition-all ${
                        activeStepIdx === idx
                          ? "bg-emerald-500/15 border-emerald-500/40 text-white shadow-lg shadow-emerald-500/10"
                          : "bg-white/5 border-white/5 text-neutral-400 hover:text-white hover:bg-white/10"
                      }`}
                    >
                      <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Step {idx + 1}</div>
                      <div className="text-xs font-semibold mt-1 truncate">{step.title}</div>
                    </button>
                  ))}
                </div>

                {/* Animated Socratic Response Stage */}
                <AnimatePresence mode="wait">
                  <motion.div
                    key={`${activeProblemIdx}-${activeStepIdx}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.3 }}
                    className="p-6 rounded-2xl bg-[#0a0f1a] border border-emerald-500/20 shadow-xl space-y-4"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-xs">
                          🌸
                        </div>
                        <div>
                          <span className="text-xs font-bold text-white block">AI Sakhi Socratic Tutor</span>
                          <span className="text-[10px] text-emerald-400">{currentStep.title}</span>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/25">
                        Grounded in NCERT
                      </span>
                    </div>

                    <div className="text-sm text-neutral-200 leading-relaxed whitespace-pre-line font-mono bg-[#060911] p-4 rounded-xl border border-white/5">
                      {currentStep.body}
                    </div>

                    <div className="flex items-center justify-between text-xs text-neutral-400 pt-2 border-t border-white/5">
                      <span>Attributed to: {currentProblem.ncertSource}</span>
                      <button
                        onClick={() => router.push("/login?role=student")}
                        className="text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1 transition-colors"
                      >
                        <span>Open Full Socratic Chat</span>
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>

            </div>
          )}

          {/* ── Mode 2: Daily Smart Sprint Choreographer ── */}
          {activeTab === "sprint" && (
            <div id="sprints" className="pt-6 space-y-6">
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-white">25-Minute Focus Sprint Choreography</h3>
                <p className="text-xs text-neutral-400">
                  Built on cognitive load theory. Sprints are strictly time-budgeted into 3 distinct pedagogical phases to prevent burnout.
                </p>
              </div>

              {/* Interactive Timeline Tabs */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {SPRINT_STAGES.map((stg, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveSprintIdx(idx)}
                    className={`p-4 rounded-2xl text-left border transition-all ${
                      activeSprintIdx === idx
                        ? "bg-white/10 border-emerald-400/50 text-white shadow-xl"
                        : "bg-white/5 border-white/5 text-neutral-400 hover:bg-white/10"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-400">{stg.phase}</span>
                      <Clock size={14} className="text-neutral-400" />
                    </div>
                    <div className="text-sm font-bold text-white mt-1">{stg.role}</div>
                    <p className="text-xs text-neutral-400 mt-2 leading-relaxed">{stg.desc}</p>
                  </button>
                ))}
              </div>

              {/* Active Sprint Stage Deep-Dive */}
              <div className="p-6 rounded-2xl bg-[#090d16] border border-white/5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap size={16} className="text-amber-400" />
                    <span className="text-sm font-bold text-white">Active Stage Protocol</span>
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300">
                    Smart Sprint Active
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                  <div className="p-3 rounded-xl bg-white/5 space-y-1">
                    <span className="font-bold text-neutral-300 block">Cognitive Objective</span>
                    <span className="text-neutral-400">Pinpoint knowledge gaps without cognitive overload.</span>
                  </div>
                  <div className="p-3 rounded-xl bg-white/5 space-y-1">
                    <span className="font-bold text-neutral-300 block">AI Intervention Rule</span>
                    <span className="text-neutral-400">Ask guiding questions; refuse to output homework answers directly.</span>
                  </div>
                  <div className="p-3 rounded-xl bg-white/5 space-y-1">
                    <span className="font-bold text-neutral-300 block">Retention Science</span>
                    <span className="text-neutral-400">SM-2 interval scheduling logs mastery score automatically.</span>
                  </div>
                </div>
                <div className="pt-2 flex justify-end">
                  <button
                    onClick={() => router.push("/login?role=student")}
                    className="btn-island primary"
                  >
                    <span>Launch 25-Min Sprint</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Mode 3: Teacher Curriculum Forge ── */}
          {activeTab === "teacher" && (
            <div className="pt-6 space-y-6">
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-white">Classroom Question Bank & Intervention Forge</h3>
                <p className="text-xs text-neutral-400">
                  Generate curriculum-aligned exam questions with detailed rubrics and Bloom&apos;s taxonomy tags in seconds.
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-[#090d16] border border-white/5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white">Grade 10 Mathematics</span>
                    <span className="text-neutral-500">·</span>
                    <span className="text-neutral-400">Trigonometry & Heights</span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-bold">
                    Olympiad Standard
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-[#060911] border border-white/5 text-sm text-neutral-200 leading-relaxed font-mono">
                  “From the top of a 75m high lighthouse, the angles of depression of two ships are 30° and 45°. If one ship is exactly behind the other on the same side, find the distance between the two ships.”
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-neutral-400 pt-1">
                  <div><strong className="text-white">Bloom&apos;s Level:</strong> Application / Analysis</div>
                  <div><strong className="text-white">Marks:</strong> 4 Marks (CBSE Section C)</div>
                  <div><strong className="text-white">NCERT Source:</strong> Chapter 9, Example 3</div>
                </div>

                <div className="pt-2 flex items-center justify-between border-t border-white/5">
                  <span className="text-xs text-emerald-400 font-semibold">✓ Verified Against Board Rubric</span>
                  <button
                    onClick={() => router.push("/login?role=teacher")}
                    className="btn-island primary"
                  >
                    <span>Open Teacher Workspace</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Mode 4: Guardian Weekly Pulse ── */}
          {activeTab === "parent" && (
            <div className="pt-6 space-y-6">
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-white">Guardian Digest & Dinner Starters</h3>
                <p className="text-xs text-neutral-400">
                  Empowering parents with positive reinforcement milestones rather than overwhelming telemetry graphs.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-5 rounded-2xl bg-[#090d16] border border-white/5 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-wider">
                    <Award size={15} />
                    <span>Celebrate Win</span>
                  </div>
                  <h4 className="text-base font-bold text-white">Excelled in Photosynthesis Light Cycle</h4>
                  <p className="text-xs text-neutral-400 leading-relaxed">
                    Aarav scored 95% across 3 consecutive Smart Sprints and overcame the misconception about stomata water loss.
                  </p>
                </div>

                <div className="p-5 rounded-2xl bg-[#090d16] border border-white/5 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase tracking-wider">
                    <MessageSquare size={15} />
                    <span>Tonight&apos;s Dinner Discussion</span>
                  </div>
                  <h4 className="text-base font-bold text-white">“Ask your child about desert plants tonight!”</h4>
                  <p className="text-xs text-neutral-400 leading-relaxed">
                    “Ask how cactus stomata open only at night to save water. It lets them teach you what they mastered today.”
                  </p>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => router.push("/login?role=parent")}
                  className="btn-island primary"
                >
                  <span>Access Guardian Portal</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          )}

        </div>
      </section>

      {/* ── 4. Interactive Grade & Curriculum Spectrum ── */}
      <section id="grades" className="site-container relative z-10 py-24 w-full">
        <div className="text-center max-w-2xl mx-auto mb-14 space-y-3">
          <span className="shimmer-pill">Adaptive Grade Spectrum</span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white">
            Pedagogy that evolves from KG to Class 12
          </h2>
          <p className="text-sm sm:text-base text-neutral-400">
            See how AI Sakhi changes its voice, analogies, and mathematical depth across developmental stages.
          </p>
        </div>

        {/* Grade Band Selector */}
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {GRADE_BANDS.map((band, idx) => (
              <button
                key={idx}
                onClick={() => setActiveGradeBand(idx)}
                className={`p-4 rounded-2xl text-center border transition-all cursor-pointer ${
                  activeGradeBand === idx
                    ? "bg-white/10 border-emerald-400/50 text-white shadow-xl scale-[1.02]"
                    : "bg-white/5 border-white/5 text-neutral-400 hover:bg-white/10"
                }`}
              >
                <div className="text-xs font-bold" style={{ color: band.accent }}>{band.subtitle}</div>
                <div className="text-sm font-black text-white mt-1">{band.title}</div>
              </button>
            ))}
          </div>

          {/* Interactive Voice Demonstration Card */}
          <div className="p-8 rounded-3xl bg-[#080d17] border border-white/10 space-y-4">
            <div className="flex items-center justify-between text-xs text-neutral-400">
              <span className="font-bold text-white">Simulated Pedagogical Voice</span>
              <span>{GRADE_BANDS[activeGradeBand].title}</span>
            </div>

            <div className="text-lg sm:text-xl font-medium text-emerald-200 leading-relaxed italic bg-[#050811] p-6 rounded-2xl border border-emerald-500/20">
              {GRADE_BANDS[activeGradeBand].quote}
            </div>

            <div className="flex items-center justify-between text-xs text-neutral-400 pt-2">
              <span>{GRADE_BANDS[activeGradeBand].detail}</span>
              <span className="font-semibold text-emerald-400">Adaptive Tone Active</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── 5. Dedicated Hardware-Tray Role Portals ── */}
      <section id="roles" className="site-container relative z-10 py-24 sm:py-32 w-full">
        <div className="text-center max-w-2xl mx-auto mb-14 space-y-3">
          <span className="shimmer-pill">Dedicated Workspaces</span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white">
            Choose your tailored portal
          </h2>
          <p className="text-sm sm:text-base text-neutral-400">
            Dedicated dashboards engineered specifically for every participant in the learning journey.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
          {ROLES.map((role) => {
            const IconComponent = role.icon;
            return (
              <motion.div
                key={role.id}
                whileHover={{ y: -6 }}
                transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
                className="bezel-shell"
              >
                <div className="bezel-core justify-between space-y-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div
                        className="w-12 h-12 rounded-2xl flex items-center justify-center"
                        style={{ background: role.glow, color: role.accent, border: `1px solid ${role.border}` }}
                      >
                        <IconComponent size={24} />
                      </div>
                      <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                        style={{ background: role.glow, color: role.accent }}
                      >
                        {role.badge}
                      </span>
                    </div>

                    <div>
                      <h3 className="text-lg font-black text-white">{role.label}</h3>
                      <p className="text-xs text-neutral-400 mt-1 leading-relaxed">{role.tagline}</p>
                    </div>

                    <ul className="space-y-2 pt-2 border-t border-white/5">
                      {role.features.map((feat, fIdx) => (
                        <li key={fIdx} className="flex items-center gap-2 text-xs text-neutral-300">
                          <CheckCircle2 size={13} style={{ color: role.accent }} className="flex-shrink-0" />
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <button
                    onClick={() => router.push(`/login?role=${role.role}`)}
                    className="w-full py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                    style={{
                      background: role.glow,
                      color: role.accent,
                      border: `1px solid ${role.border}`,
                    }}
                  >
                    <span>Enter as {role.label.split(" ")[0]}</span>
                    <ArrowRight size={13} />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* ── 6. Editorial High-End Footer ── */}
      <footer className="relative z-10 w-full border-t border-white/10 mt-auto py-14 px-6 bg-[#02050b]">
        <div className="site-container flex flex-col sm:flex-row items-center justify-between gap-6 text-center sm:text-left">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-sm shadow-md">
              🌸
            </div>
            <div>
              <span className="text-sm font-black text-white block">AI Sakhi</span>
              <span className="text-[11px] text-neutral-400">NCERT-Aligned Adaptive Learning Platform</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-neutral-400">
            <Link href="/demo" className="hover:text-emerald-400 transition-colors">Interactive Demo</Link>
            <Link href="/onboard" className="hover:text-emerald-400 transition-colors">Onboarding</Link>
            <Link href="/login?role=student" className="hover:text-emerald-400 transition-colors">Student Sign In</Link>
            <a href="https://github.com/Tayab-Ahamed/AI-Sakhi" target="_blank" rel="noreferrer" className="hover:text-white transition-colors">
              GitHub Repository
            </a>
          </div>

          <div className="text-xs text-neutral-400">
            © {new Date().getFullYear()} AI Sakhi. Built for learners across India 🇮🇳
          </div>
        </div>
      </footer>

    </div>
  );
}
