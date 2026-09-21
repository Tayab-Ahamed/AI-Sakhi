"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
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
        className="relative w-full h-full flex items-center justify-center rounded-3xl overflow-hidden p-6 select-none"
        style={{ minHeight: 380, perspective: "1000px" }}
      >
        <div className="relative w-64 h-64 flex items-center justify-center">
          <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-emerald-600 via-teal-400 to-emerald-300 shadow-[0_0_50px_rgba(16,185,129,0.7)] flex items-center justify-center animate-pulse">
            <span className="text-3xl select-none">🌸</span>
          </div>
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
  Cpu,
  Layers,
  Compass,
  FileCheck,
  Zap,
} from "lucide-react";

const ROLES = [
  {
    id: "student",
    label: "Student Companion",
    role: "student",
    tagline: "Master concepts through Socratic dialogue & Smart Sprints",
    icon: GraduationCap,
    accent: "#10b981",
    glow: "rgba(16, 185, 129, 0.18)",
    border: "rgba(16, 185, 129, 0.3)",
    features: ["KaTeX Math Tutor", "Smart Sprints (25m)", "Spaced Flashcards", "Misconception Radar"],
    badge: "KG – Class 12",
  },
  {
    id: "teacher",
    label: "Teacher Workspace",
    role: "teacher",
    tagline: "Curriculum question bank & verified classroom analytics",
    icon: BookOpen,
    accent: "#8b5cf6",
    glow: "rgba(139, 92, 246, 0.18)",
    border: "rgba(139, 92, 246, 0.3)",
    features: ["Question Bank Auth", "Submission Grading", "Intervention Signals", "Curriculum Outcomes"],
    badge: "CBSE & ICSE",
  },
  {
    id: "parent",
    label: "Guardian Digest",
    role: "parent",
    tagline: "Weekly celebration insights & conversation starters",
    icon: Users,
    accent: "#f59e0b",
    glow: "rgba(245, 158, 11, 0.18)",
    border: "rgba(245, 158, 11, 0.3)",
    features: ["Celebration Wins", "Priority Focus Areas", "Dinner Starters", "Study Time Audit"],
    badge: "Positive AI",
  },
  {
    id: "admin",
    label: "School Administrator",
    role: "admin",
    tagline: "Tenant isolation, role governance & audit logs",
    icon: ShieldCheck,
    accent: "#f43f5e",
    glow: "rgba(244, 63, 94, 0.18)",
    border: "rgba(244, 63, 94, 0.3)",
    features: ["User Governance", "Safety Event Audit", "Export Workflows", "Tenant Metrics"],
    badge: "Enterprise",
  },
];

const TRUST_METRICS = [
  { label: "NCERT Subjects", value: "54+", detail: "CBSE mapped" },
  { label: "Release Gate", value: "100%", detail: "Safety verified" },
  { label: "Math Engine", value: "KaTeX", detail: "Formula rendering" },
  { label: "Recall Retention", value: "SM-2", detail: "Spaced repetition" },
];

export default function Home() {
  const router = useRouter();
  const { user, isReady } = useUser();

  useEffect(() => {
    if (!isReady) return;
    if (user) {
      router.replace(getRoleLandingPage(user.role));
    }
  }, [isReady, router, user]);

  return (
    <div className="min-h-screen bg-[#07090e] text-neutral-100 flex flex-col selection:bg-emerald-500/30 selection:text-emerald-200 overflow-x-hidden relative">
      {/* Ambient background depth lights */}
      <div className="ambient-glow-mesh" />
      <div className="absolute top-[30%] right-[-10%] w-[500px] h-[500px] rounded-full bg-emerald-600/10 blur-[130px] pointer-events-none" />
      <div className="absolute top-[65%] left-[-10%] w-[550px] h-[550px] rounded-full bg-indigo-600/10 blur-[140px] pointer-events-none" />

      {/* ── 1. Fluid Floating Island Navigation ── */}
      <header className="fluid-nav-pill">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20 ring-1 ring-white/20">
            <span className="text-base select-none">🌸</span>
          </div>
          <div>
            <span className="text-base font-extrabold tracking-tight text-white block leading-none">AI Sakhi</span>
            <span className="text-[10px] font-semibold text-emerald-400 uppercase tracking-widest">Adaptive Learning</span>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-6 text-xs font-semibold text-neutral-300">
          <a href="#experience" className="hover:text-white transition-colors">Experience</a>
          <a href="#architecture" className="hover:text-white transition-colors">Evidence Engine</a>
          <a href="#roles" className="hover:text-white transition-colors">Role Portals</a>
          <Link href="/demo" className="hover:text-emerald-400 transition-colors">Interactive Demo</Link>
        </div>

        <div className="flex items-center gap-2">
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

      {/* ── 2. Split Hero Stage (Kinetic Typography + 3D Knowledge Orb) ── */}
      <section className="relative z-10 max-w-[1140px] mx-auto px-6 pt-24 sm:pt-28 pb-20 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          {/* Left Hero Column */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.32, 0.72, 0, 1] }}
            className="lg:col-span-7 space-y-6"
          >
            <div>
              <span className="shimmer-pill">
                <Sparkles size={13} className="text-emerald-400 animate-pulse" />
                Evidence-Grounded Learning Companion
              </span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white leading-[1.08]">
              Learn with conviction.
              <br />
              <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-300 bg-clip-text text-transparent">
                Every Concept. Every Role.
              </span>
            </h1>

            <p className="text-base sm:text-lg text-neutral-400 max-w-xl font-normal leading-relaxed">
              Not just another chatbot. AI Sakhi is a patient, NCERT-grounded tutor that pinpoints misconceptions,
              choreographs focused 25-minute Smart Sprints, and unites students, teachers, and guardians in one cohesive loop.
            </p>

            {/* Action Buttons */}
            <div className="pt-2 flex flex-wrap items-center gap-4">
              <button
                onClick={() => router.push("/login?role=student")}
                className="btn-island primary"
              >
                <span>Launch Student Companion</span>
                <span className="btn-disc">
                  <ArrowRight size={14} className="text-white" />
                </span>
              </button>

              <Link
                href="/demo"
                className="btn-island secondary"
              >
                <span>Try Live Interactive Tour</span>
                <span className="btn-disc bg-white/10">
                  <Zap size={14} className="text-emerald-400" />
                </span>
              </Link>
            </div>

            {/* Micro Trust Strip */}
            <div className="pt-6 border-t border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-4">
              {TRUST_METRICS.map((metric, idx) => (
                <div key={idx} className="space-y-0.5">
                  <div className="text-lg font-black text-white">{metric.value}</div>
                  <div className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">{metric.label}</div>
                  <div className="text-[11px] text-neutral-400">{metric.detail}</div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Right Hero Column: Interactive Three.js Knowledge Orb */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.85, ease: [0.32, 0.72, 0, 1] }}
            className="lg:col-span-5 relative"
          >
            <div className="relative w-full aspect-square max-w-[460px] mx-auto">
              {/* Backing Ambient Disc */}
              <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-emerald-500/15 via-teal-500/10 to-indigo-500/10 blur-2xl pointer-events-none" />

              {/* Three.js Canvas Container */}
              <div className="relative z-10 w-full h-full rounded-3xl overflow-hidden border border-white/10 bg-[#0c1017]/80 backdrop-blur-md shadow-2xl shadow-black/80">
                <ThreeKnowledgeOrb className="w-full h-full" />
              </div>

              {/* Floating Glass Telemetry Chips */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35, duration: 0.6 }}
                className="absolute -top-3 left-2 sm:-top-4 sm:-left-4 z-20 bg-[#161d27]/90 border border-emerald-500/30 backdrop-blur-xl rounded-2xl px-3.5 py-2 sm:px-4 sm:py-2.5 shadow-xl flex items-center gap-2.5 sm:gap-3"
              >
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                <div>
                  <div className="text-[11px] font-extrabold text-white">NCERT Grounded</div>
                  <div className="text-[10px] text-neutral-400">Class 6–12 Page Attribution</div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.6 }}
                className="absolute -bottom-3 right-2 sm:-bottom-4 sm:-right-4 z-20 bg-[#161d27]/90 border border-indigo-500/30 backdrop-blur-xl rounded-2xl px-3.5 py-2 sm:px-4 sm:py-2.5 shadow-xl flex items-center gap-2.5 sm:gap-3"
              >
                <div className="w-8 h-8 rounded-xl bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                  <Cpu size={16} />
                </div>
                <div>
                  <div className="text-[11px] font-extrabold text-white">Adaptive Learning Engine</div>
                  <div className="text-[10px] text-neutral-400">SM-2 Spaced Recall Active</div>
                </div>
              </motion.div>
            </div>
          </motion.div>

        </div>
      </section>

      {/* ── 3. Asymmetrical Bento Showcase (Double-Bezel Architecture) ── */}
      <section id="experience" className="relative z-10 max-w-[1140px] mx-auto px-6 py-20 w-full">
        <div className="text-center max-w-2xl mx-auto mb-14 space-y-3">
          <span className="shimmer-pill">Engineered for Depth</span>
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
            A comprehensive suite for academic excellence
          </h2>
          <p className="text-sm sm:text-base text-neutral-400">
            From textbook-grounded Socratic tutoring to teacher question banks and weekly guardian digests.
          </p>
        </div>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">

          {/* Card 1: Student Math & Chat Tutor (Span 8) */}
          <div className="md:col-span-8 bezel-shell">
            <div className="bezel-core space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                    <GraduationCap size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-white">Student Socratic Companion</h3>
                    <p className="text-xs text-neutral-400">Multilingual tutoring with textbook formula precision</p>
                  </div>
                </div>
                <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  KaTeX Active
                </span>
              </div>

              {/* Simulated Chat Dialogue Preview */}
              <div className="rounded-2xl bg-[#090c10] border border-white/5 p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-emerald-600/30 border border-emerald-400/40 flex items-center justify-center text-xs font-black text-emerald-300">
                    🌸
                  </div>
                  <div className="flex-1 bg-white/5 rounded-2xl rounded-tl-sm p-3.5 text-xs text-neutral-200 leading-relaxed space-y-2">
                    <p className="font-medium">
                      Let&apos;s derive the quadratic roots formula using completion of squares:
                    </p>
                    <div className="p-2.5 rounded-xl bg-[#0c1017] border border-white/10 font-mono text-emerald-300 text-sm text-center">
                      x = (-b ± √(b² - 4ac)) / (2a)
                    </div>
                    <p className="text-[11px] text-neutral-400 font-sans">
                      Source: NCERT Class 10 Mathematics · Chapter 4 (Quadratic Equations), Page 78.
                    </p>
                  </div>
                </div>
              </div>

              {/* Daily Smart Sprint Bar */}
              <div className="p-3.5 rounded-2xl bg-[#141923] border border-white/5 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-xs font-bold text-white">Daily Smart Sprint (25 mins):</span>
                </div>
                <div className="flex items-center gap-2 text-[11px]">
                  <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 font-bold">Warmup (5m)</span>
                  <span className="text-neutral-500">→</span>
                  <span className="px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 font-bold">Practice (15m)</span>
                  <span className="text-neutral-500">→</span>
                  <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 font-bold">Recall (5m)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Guardian Digest (Span 4) */}
          <div className="md:col-span-4 bezel-shell">
            <div className="bezel-core justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                    <Users size={20} />
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                    Weekly Digest
                  </span>
                </div>

                <h3 className="text-base font-black text-white mb-1">Guardian Insight</h3>
                <p className="text-xs text-neutral-400 mb-4">Positive reinforcement without overwhelming data</p>

                {/* Celebrate Win Card */}
                <div className="p-3 rounded-xl bg-[#090c10] border border-amber-500/20 space-y-1 mb-3">
                  <div className="text-[10px] font-black uppercase tracking-wider text-amber-400">Celebrate Win 🏆</div>
                  <div className="text-xs font-bold text-neutral-200">Excels in Photosynthesis & Plant Cells</div>
                </div>

                {/* Conversation Starter */}
                <div className="p-3 rounded-xl bg-[#090c10] border-l-2 border-emerald-400 text-xs text-neutral-300 italic leading-relaxed">
                  &ldquo;Ask your child how stomata regulate water loss in desert plants tonight!&rdquo;
                </div>
              </div>

              <button
                onClick={() => router.push("/login?role=parent")}
                className="w-full py-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-bold transition-colors"
              >
                Access Guardian Portal →
              </button>
            </div>
          </div>

          {/* Card 3: Teacher Curriculum Bank (Span 4) */}
          <div className="md:col-span-4 bezel-shell">
            <div className="bezel-core justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400">
                    <BookOpen size={20} />
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/15 text-purple-300 border border-purple-500/30">
                    Educator Hub
                  </span>
                </div>

                <h3 className="text-base font-black text-white mb-1">Curriculum Question Bank</h3>
                <p className="text-xs text-neutral-400 mb-4">Draft, review, and approve classroom questions</p>

                <div className="space-y-2">
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#090c10] border border-white/5 text-xs">
                    <span className="font-semibold text-neutral-300">Grade 8 Science · Acids & Bases</span>
                    <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded">Approved</span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#090c10] border border-white/5 text-xs">
                    <span className="font-semibold text-neutral-300">Grade 10 Math · Triangles</span>
                    <span className="text-[10px] font-bold text-purple-400 bg-purple-500/15 px-2 py-0.5 rounded">Needs Review</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => router.push("/login?role=teacher")}
                className="w-full py-2.5 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 text-purple-300 text-xs font-bold transition-colors"
              >
                Open Educator Portal →
              </button>
            </div>
          </div>

          {/* Card 4: Evidence & Safety Engine (Span 8) */}
          <div className="md:col-span-8 bezel-shell">
            <div className="bezel-core space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                    <Layers size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-white">Deterministic Evidence & Safety Core</h3>
                    <p className="text-xs text-neutral-400">Eliminating hallucinations through strict vector attribution</p>
                  </div>
                </div>
                <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                  100% Eval Score
                </span>
              </div>

              {/* Architecture Pipeline Flow */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2">
                <div className="p-3 rounded-xl bg-[#090c10] border border-white/5 text-center space-y-1">
                  <FileCheck size={18} className="text-cyan-400 mx-auto" />
                  <div className="text-xs font-bold text-white">1. Textbook Chunks</div>
                  <div className="text-[10px] text-neutral-400">Page & chapter tags</div>
                </div>

                <div className="p-3 rounded-xl bg-[#090c10] border border-white/5 text-center space-y-1">
                  <Compass size={18} className="text-emerald-400 mx-auto" />
                  <div className="text-xs font-bold text-white">2. Vector Search</div>
                  <div className="text-[10px] text-neutral-400">ChromaDB cosine rank</div>
                </div>

                <div className="p-3 rounded-xl bg-[#090c10] border border-white/5 text-center space-y-1">
                  <Cpu size={18} className="text-indigo-400 mx-auto" />
                  <div className="text-xs font-bold text-white">3. Unified LLM</div>
                  <div className="text-[10px] text-neutral-400">Strict evidence bounds</div>
                </div>

                <div className="p-3 rounded-xl bg-[#090c10] border border-white/5 text-center space-y-1">
                  <ShieldCheck size={18} className="text-emerald-400 mx-auto" />
                  <div className="text-xs font-bold text-white">4. Safety Gate</div>
                  <div className="text-[10px] text-neutral-400">Zero fake citations</div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* ── 4. Dedicated Role Portals (Double-Bezel Hardware Trays) ── */}
      <section id="roles" className="relative z-10 max-w-[1140px] mx-auto px-6 py-16 w-full">
        <div className="text-center max-w-2xl mx-auto mb-12 space-y-2">
          <span className="shimmer-pill">Role Portals</span>
          <h2 className="text-3xl font-black tracking-tight text-white">
            Choose your tailored workspace
          </h2>
          <p className="text-xs sm:text-sm text-neutral-400">
            Dedicated dashboards customized for every participant in the learning journey.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {ROLES.map((role) => {
            const IconComponent = role.icon;
            return (
              <motion.div
                key={role.id}
                whileHover={{ y: -6 }}
                transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
                className="bezel-shell"
              >
                <div className="bezel-core justify-between space-y-5">
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
                      <h3 className="text-base font-black text-white">{role.label}</h3>
                      <p className="text-xs text-neutral-400 mt-1 leading-relaxed">{role.tagline}</p>
                    </div>

                    <ul className="space-y-2 pt-1">
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
                    className="w-full py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all"
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

      {/* ── 5. Editorial Footer ── */}
      <footer className="relative z-10 border-t border-white/10 mt-auto py-12 px-6 bg-[#05070a]">
        <div className="max-w-[1140px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-sm">
              🌸
            </div>
            <div>
              <span className="text-sm font-black text-white block">AI Sakhi</span>
              <span className="text-[11px] text-neutral-400">Trustworthy Adaptive Learning Platform</span>
            </div>
          </div>

          <div className="flex items-center gap-6 text-xs text-neutral-400">
            <Link href="/demo" className="hover:text-emerald-400 transition-colors">Interactive Demo</Link>
            <Link href="/onboard" className="hover:text-emerald-400 transition-colors">Onboarding</Link>
            <Link href="/login?role=student" className="hover:text-emerald-400 transition-colors">Student Sign In</Link>
            <a href="https://github.com/Tayab-Ahamed/AI-Sakhi" target="_blank" rel="noreferrer" className="hover:text-white transition-colors">
              GitHub Repository
            </a>
          </div>

          <div className="text-xs text-neutral-400">
            © {new Date().getFullYear()} AI Sakhi. Built with care for learners across India 🇮🇳
          </div>
        </div>
      </footer>
    </div>
  );
}
