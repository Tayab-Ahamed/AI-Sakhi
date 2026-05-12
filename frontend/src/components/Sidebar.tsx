"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { MessageSquare, Zap, LayoutDashboard, BookOpen, Plus, LogOut, Globe, Timer, Trophy, Presentation, Layers3, Eye, Zap as ZapIcon, Type, GraduationCap, Users, Shield, FileText, FileDown } from "lucide-react";

import { api } from "@/lib/api";
import { useAccessibility } from "@/lib/accessibility-context";
import { useUser } from "@/lib/user-context";

const NAV = [
  { href: "/chat",         icon: MessageSquare,  label: "Chat",            roles: null },
  { href: "/quiz",         icon: Zap,            label: "Quiz",            roles: null },
  { href: "/dashboard",    icon: LayoutDashboard, label: "Dashboard",      roles: null },
  { href: "/leaderboard",  icon: Trophy,         label: "Leaderboard",     roles: null },
  { href: "/study-plan",   icon: BookOpen,       label: "Study Plan",      roles: null },
  { href: "/study-notes",  icon: FileText,       label: "Study Notes",     roles: null },
  { href: "/flashcards",   icon: Layers3,        label: "Flashcards",      roles: null },
  { href: "/focus-timer",  icon: Timer,          label: "Focus Timer",     roles: null },
  { href: "/export",       icon: FileDown,       label: "Export Report",   roles: null },
  { href: "/teacher",      icon: GraduationCap,  label: "Teacher Tools",   roles: ["teacher", "admin"] },
  { href: "/parent",       icon: Users,          label: "Parent View",     roles: ["parent", "admin"] },
  { href: "/admin",        icon: Shield,         label: "Admin Console",   roles: ["admin"] },
  { href: "/demo",         icon: Presentation,   label: "Demo Mode",       roles: null },
];

const LANGUAGES = ["English", "Hinglish", "Hindi", "Kannada", "Tamil"] as const;
const ROLES = ["student", "parent", "teacher", "admin"] as const;

export default function Sidebar() {
  const path = usePathname();
  const router = useRouter();
  const [ragReady, setRagReady] = useState<boolean | null>(null);
  const [ragChunks, setRagChunks] = useState(0);
  const [seedingDemo, setSeedingDemo] = useState(false);
  const { user, updateProfile, clearUser } = useUser();
  const { dyslexiaMode, reduceMotion, fontSize, toggleDyslexia, toggleReduceMotion, setFontSize } = useAccessibility();

  useEffect(() => {
    let ignore = false;
    api.getRagStats()
      .then((stats) => {
        if (ignore) return;
        setRagReady(Boolean(stats.ready));
        setRagChunks(Number(stats.chunk_count || 0));
      })
      .catch(() => {
        if (ignore) return;
        setRagReady(false);
        setRagChunks(0);
      });
    return () => {
      ignore = true;
    };
  }, []);

  const handleLangChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (!user) return;
    try {
      await updateProfile({ language: e.target.value as typeof LANGUAGES[number] });
    } catch {
      alert("Could not save your language preference right now.");
    }
  };

  const handleLogout = () => {
    clearUser();
    router.push("/onboard");
  };

  const handleNewSession = async () => {
    const chatSessionId = typeof window !== "undefined" ? localStorage.getItem("sakhi_chat_session_id") : null;
    if (chatSessionId) {
      try {
        await api.clearChat(chatSessionId);
      } catch {
        // Local reset is still enough for the user to start fresh.
      }
      localStorage.removeItem("sakhi_chat_session_id");
    }
    router.push("/chat");
    router.refresh();
  };

  const handleSeedDemo = async () => {
    setSeedingDemo(true);
    try {
      await api.seedDemoData();
      alert("Demo data is ready. Open Dashboard or Leaderboard.");
    } catch {
      alert("Could not load demo data right now.");
    } finally {
      setSeedingDemo(false);
    }
  };

  const handleRoleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (!user) return;
    try {
      await updateProfile({ role: e.target.value as typeof ROLES[number] });
    } catch {
      alert("Could not save your role right now.");
    }
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <span style={{ fontSize: 22 }}>S</span>
        <span>AI Sakhi</span>
      </div>

      <button className="btn btn-primary btn-full" style={{ marginBottom: 12, justifyContent: "center" }} onClick={handleNewSession}>
        <Plus size={15} />
        New Session
      </button>

      <div style={{ marginBottom: 12 }}>
        <div className="sidebar-section-label" style={{ paddingTop: 0 }}>Language</div>
        <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
          <Globe size={14} style={{ position: "absolute", left: 10, color: "var(--text-muted)", pointerEvents: "none" }} />
          <select
            className="input input-select"
            value={user?.language || "English"}
            onChange={handleLangChange}
            style={{ paddingLeft: 30, fontSize: 13, height: 36, borderRadius: "var(--radius-md)" }}
          >
            {LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <div className="sidebar-section-label" style={{ paddingTop: 0 }}>Role</div>
        <select
          className="input input-select"
          value={user?.role || "student"}
          onChange={handleRoleChange}
          style={{ fontSize: 13, height: 36, borderRadius: "var(--radius-md)" }}
        >
          {ROLES.map((role) => <option key={role} value={role}>{role}</option>)}
        </select>
      </div>

      {/* Phase 9 — Accessibility Settings */}
      <div style={{ marginBottom: 12 }}>
        <div className="sidebar-section-label" style={{ paddingTop: 0 }}>Accessibility</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {/* Dyslexia Mode */}
          <button
            onClick={toggleDyslexia}
            style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "7px 10px", borderRadius: "var(--radius-md)",
              border: `1.5px solid ${dyslexiaMode ? "#f59e0b" : "var(--border)"}`,
              background: dyslexiaMode ? "#fef3c7" : "white",
              cursor: "pointer", fontSize: 12, fontWeight: 500,
              color: dyslexiaMode ? "#92400e" : "var(--text-secondary)",
              fontFamily: "Inter, sans-serif",
              transition: "all 0.15s",
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Eye size={13} /> Dyslexia Mode
            </span>
            <span style={{
              width: 28, height: 16, borderRadius: 99, display: "flex", alignItems: "center",
              background: dyslexiaMode ? "#f59e0b" : "#d1d5db",
              padding: "0 2px", transition: "background 0.2s",
            }}>
              <span style={{
                width: 12, height: 12, borderRadius: "50%", background: "white",
                transform: dyslexiaMode ? "translateX(12px)" : "translateX(0)",
                transition: "transform 0.2s",
              }} />
            </span>
          </button>

          {/* Reduce Motion */}
          <button
            onClick={toggleReduceMotion}
            style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "7px 10px", borderRadius: "var(--radius-md)",
              border: `1.5px solid ${reduceMotion ? "#6366f1" : "var(--border)"}`,
              background: reduceMotion ? "#eef2ff" : "white",
              cursor: "pointer", fontSize: 12, fontWeight: 500,
              color: reduceMotion ? "#4338ca" : "var(--text-secondary)",
              fontFamily: "Inter, sans-serif",
              transition: "all 0.15s",
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <ZapIcon size={13} /> Reduce Motion
            </span>
            <span style={{
              width: 28, height: 16, borderRadius: 99, display: "flex", alignItems: "center",
              background: reduceMotion ? "#6366f1" : "#d1d5db",
              padding: "0 2px", transition: "background 0.2s",
            }}>
              <span style={{
                width: 12, height: 12, borderRadius: "50%", background: "white",
                transform: reduceMotion ? "translateX(12px)" : "translateX(0)",
                transition: "transform 0.2s",
              }} />
            </span>
          </button>

          {/* Font Size */}
          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
            <Type size={12} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
            {(["sm", "md", "lg"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setFontSize(s)}
                style={{
                  flex: 1,
                  padding: "4px 0",
                  borderRadius: "var(--radius-sm)",
                  border: `1.5px solid ${fontSize === s ? "var(--emerald)" : "var(--border)"}`,
                  background: fontSize === s ? "var(--emerald-light)" : "white",
                  cursor: "pointer",
                  fontSize: s === "sm" ? 10 : s === "lg" ? 15 : 12,
                  fontWeight: 600,
                  color: fontSize === s ? "var(--emerald-dark)" : "var(--text-muted)",
                  fontFamily: "Inter, sans-serif",
                  transition: "all 0.15s",
                }}
              >
                A{s === "sm" ? "−" : s === "lg" ? "+" : ""}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="sidebar-divider" />

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
        <button className="btn btn-secondary btn-full" onClick={handleSeedDemo} disabled={seedingDemo} style={{ justifyContent: "center" }}>
          {seedingDemo ? "Loading demo data..." : "Load Demo Data"}
        </button>
        <div style={{ padding: "10px 8px", background: "#f5f5f3", borderRadius: "var(--radius-md)" }}>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 2 }}>NCERT RAG</div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
            {ragReady === null ? "Checking index status..." : ragReady ? `${ragChunks} chunks ready` : "Not loaded. Run ingest.py."}
          </div>
        </div>
      </div>

      <div className="sidebar-divider" />

      <div className="sidebar-section-label">Navigation</div>
      <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {NAV
          .filter(({ roles }) => !roles || roles.includes(user?.role || ""))
          .map(({ href, icon: Icon, label }) => (
            <Link key={href} href={href} className={`nav-item ${path === href ? "active" : ""}`}>
              <Icon size={16} />
              {label}
            </Link>
          ))
        }
      </nav>

      <div className="sidebar-divider" />

      {user?.name && (
        <div style={{ padding: "10px 8px", background: "#f5f5f3", borderRadius: "var(--radius-md)", marginBottom: 8 }}>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 2 }}>Signed in as</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{user.name}</div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>Class {user.class_} · {user.weak_subject}</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>{user.role} · {user.organization_name || "Demo School"}</div>
        </div>
      )}

      <div className="sidebar-bottom" style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <button className="nav-item" onClick={handleLogout}>
          <LogOut size={15} />
          Change Profile
        </button>
      </div>
    </aside>
  );
}
