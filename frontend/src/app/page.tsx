"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { ArrowRight, BookOpenText, Brain, Chalkboard, Check, ChartLineUp, Clock, GraduationCap, ShieldCheck, Users } from "@phosphor-icons/react";
import { BrandMark } from "@/components/BrandMark";
import { useUser } from "@/lib/user-context";
import { getRoleLandingPage } from "@/lib/auth";

const roles = [
  { label: "Student", detail: "Learn with confidence", icon: GraduationCap, href: "/login?role=student" },
  { label: "Teacher", detail: "See where help is needed", icon: Chalkboard, href: "/login?role=teacher" },
  { label: "Guardian", detail: "Follow progress simply", icon: Users, href: "/login?role=parent" },
  { label: "Admin", detail: "Understand your school", icon: ShieldCheck, href: "/login?role=admin" },
];

const capabilities = [
  { icon: Brain, eyebrow: "Understand", title: "Socratic conversations", body: "Sakhi asks the next useful question instead of handing over a shortcut." },
  { icon: Clock, eyebrow: "Practise", title: "Focused study sprints", body: "Turn a vague study session into one calm, achievable 25-minute block." },
  { icon: BookOpenText, eyebrow: "Remember", title: "Spaced recall", body: "Bring important ideas back at the right time so learning sticks beyond the quiz." },
  { icon: ChartLineUp, eyebrow: "Notice", title: "Clear progress", body: "See what is becoming easier and where a little more practice will help." },
];

export default function Home() {
  const { user } = useUser();

  return (
    <main className="landing-page">
      <header className="landing-nav">
        <Link href="/" className="landing-brand" aria-label="AI Sakhi home"><BrandMark size="sm" showLabel /></Link>
        <nav className="landing-links" aria-label="Main navigation"><a href="#what-you-get">What you get</a><a href="#how-it-works">How it works</a><a href="#for-everyone">For everyone</a></nav>
        <Link href={user ? getRoleLandingPage(user.role) : "/login"} className="landing-button landing-button-primary">{user ? "Open dashboard" : "Start learning"} <ArrowRight size={15} /></Link>
      </header>

      <section className="landing-hero landing-container">
        <div className="landing-hero-copy"><p className="landing-kicker"><span /> Free for students · CBSE &amp; ICSE</p><h1>Good learning starts with a better question.</h1><p className="landing-lede">AI Sakhi helps KG–12 students understand concepts, practise with purpose, and build the confidence to think for themselves.</p><div className="landing-actions"><Link href="/login" className="landing-button landing-button-primary landing-button-large">Start learning free <ArrowRight size={17} /></Link><a href="#how-it-works" className="landing-button landing-button-secondary landing-button-large">See how it works</a></div><div className="landing-proof"><div><strong>40+</strong><span>subjects</span></div><div><strong>KG–12</strong><span>all grades</span></div><div><strong>5</strong><span>study languages</span></div></div></div>
        <motion.div className="landing-hero-visual" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}><div className="landing-visual-topline"><span className="status-dot" /> A calmer way to study</div><Image src="/student-portrait.jpg" alt="Student studying with AI Sakhi" fill priority sizes="(max-width: 900px) 100vw, 50vw" className="landing-hero-image" /><div className="landing-visual-note"><span>Today&apos;s focus</span><strong>Understand, then practise</strong><small>One step at a time</small></div></motion.div>
      </section>

      <section id="what-you-get" className="landing-section landing-container"><div className="landing-section-heading"><p className="landing-kicker">Built for real study days</p><h2>Everything a student needs to make progress feel visible.</h2><p>Simple tools, connected around the way students actually learn.</p></div><div className="landing-capability-grid">{capabilities.map(({ icon: Icon, eyebrow, title, body }) => <article key={title} className="landing-capability"><div className="landing-icon"><Icon size={21} /></div><p className="landing-card-eyebrow">{eyebrow}</p><h3>{title}</h3><p>{body}</p></article>)}</div></section>

      <section id="how-it-works" className="landing-section landing-container landing-method"><div className="landing-method-visual" aria-label="The Sakhi learning method"><div className="method-orbit method-orbit-one" /><div className="method-orbit method-orbit-two" /><div className="method-core"><BrandMark size="lg" /></div><div className="method-node method-node-one"><BookOpenText size={17} /> Understand</div><div className="method-node method-node-two"><Brain size={17} /> Practise</div><div className="method-node method-node-three"><ChartLineUp size={17} /> Progress</div></div><div className="landing-method-copy"><p className="landing-kicker">The Sakhi method</p><h2>The student does the thinking. Sakhi keeps the map.</h2><p>When a concept feels difficult, Sakhi breaks it into the next small question. Students build understanding they can use again, not just an answer they can copy.</p><div className="landing-check-list"><span><Check size={16} /> Explanations matched to the student&apos;s level</span><span><Check size={16} /> Guidance connected to the school curriculum</span><span><Check size={16} /> Practice that follows what the student needs next</span></div><Link href="/login" className="text-link">Try a study session <ArrowRight size={15} /></Link></div></section>

      <section id="for-everyone" className="landing-section landing-container"><div className="landing-section-heading"><p className="landing-kicker">One school, one shared picture</p><h2>Useful to every person around the learner.</h2><p>Each role sees the work that matters to them, without losing the student&apos;s story.</p></div><div className="landing-role-grid">{roles.map(({ label, detail, icon: Icon, href }) => <Link key={label} href={href} className="landing-role-card"><div className="landing-role-icon"><Icon size={20} /></div><div><strong>{label}</strong><span>{detail}</span></div><ArrowRight size={17} className="landing-role-arrow" /></Link>)}</div></section>

      <section className="landing-cta landing-container"><div><p className="landing-kicker">Ready when you are</p><h2>Make the next study session count.</h2><p>No subscription. No complicated setup. Just a more thoughtful place to learn.</p></div><Link href="/login" className="landing-button landing-button-primary landing-button-large">Create a free account <ArrowRight size={17} /></Link></section>

      <footer className="landing-footer landing-container"><div className="landing-brand"><BrandMark size="sm" showLabel /></div><p>Adaptive learning for KG–12 · Built for India</p><div className="landing-footer-links"><a href="#">Privacy</a><a href="#">Terms</a><a href="#">Contact</a></div></footer>
    </main>
  );
}
