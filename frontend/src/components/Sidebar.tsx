"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  MessageSquare, Zap, LayoutDashboard, BookOpen, Plus, LogOut, Globe,
  Timer, Trophy, Layers3, GraduationCap, Users, Shield, FileText,
  FileDown, Moon, Sun, User, BarChart2, ClipboardList, Settings,
} from "lucide-react";

import { api } from "@/lib/api";
import { useAccessibility } from "@/lib/accessibility-context";
import { useUser } from "@/lib/user-context";
import { ROLE_CONFIG } from "@/lib/auth";
import NotificationCenter from "@/components/NotificationCenter";
import { toggleTheme, initTheme, getTheme, type Theme } from "@/lib/theme";

// ── Per-role navigation ────────────────────────────────────────────────────
const STUDENT_NAV = [
  { href: "/chat",           icon: MessageSquare,  label: "Chat with Sakhi" },
  { href: "/quiz",           icon: Zap,            label: "Quiz Practice"   },
  { href: "/dashboard",      icon: LayoutDashboard, label: "My Dashboard"   },
  { href: "/mastery",        icon: BarChart2,      label: "Topic Mastery"   },
  { href: "/leaderboard",    icon: Trophy,         label: "Leaderboard"     },
  { href: "/study-plan",     icon: BookOpen,       label: "Study Plan"      },
  { href: "/study-notes",    icon: FileText,       label: "Study Notes"     },
  { href: "/practice-paper", icon: ClipboardList,  label: "Practice Papers" },
  { href: "/flashcards",     icon: Layers3,        label: "Flashcards"      },
  { href: "/focus-timer",    icon: Timer,          label: "Focus Timer"     },
  { href: "/export",         icon: FileDown,       label: "Export Report"   },
];

const TEACHER_NAV = [
  { href: "/teacher",   icon: GraduationCap, label: "Teacher Dashboard" },
  { href: "/chat",      icon: MessageSquare, label: "AI Assistant"      },
  { href: "/quiz",      icon: Zap,           label: "Generate Quiz"     },
  { href: "/export",    icon: FileDown,      label: "Export Reports"    },
];

const PARENT_NAV = [
  { href: "/parent",    icon: Users,         label: "Child Progress"    },
  { href: "/export",    icon: FileDown,      label: "Export Report"     },
];

const ADMIN_NAV = [
  { href: "/admin",     icon: Shield,        label: "Admin Console"     },
  { href: "/teacher",   icon: GraduationCap, label: "Teacher Tools"     },
  { href: "/parent",    icon: Users,         label: "Parent View"       },
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard"       },
  { href: "/export",    icon: FileDown,      label: "Export Report"     },
  { href: "/demo",      icon: Settings,      label: "Demo Mode"         },
];

function getNavItems(role: string) {
  switch (role) {
    case "teacher": return TEACHER_NAV;
    case "parent":  return PARENT_NAV;
    case "admin":   return ADMIN_NAV;
    default:        return STUDENT_NAV;
  }
}

// ── Role-specific sidebar accent colours ────────────────────────────────────
function getRoleAccent(role: string) {
  return ROLE_CONFIG[role]?.color || "#059669";
}

const LANGUAGES = ["English", "Hinglish", "Hindi", "Kannada", "Tamil"] as const;

export default function Sidebar() {
  const path = usePathname();
  const router = useRouter();
  const [ragReady, setRagReady] = useState<boolean | null>(null);
  const [ragChunks, setRagChunks] = useState(0);
  const [theme, setThemeState] = useState<Theme>("light");
  const { user, updateProfile, clearUser } = useUser();
  const { dyslexiaMode, toggleDyslexia, fontSize, setFontSize } = useAccessibility();

  const role = user?.role || "student";
  const accent = getRoleAccent(role);
  const cfg = ROLE_CONFIG[role] || ROLE_CONFIG.student;
  const navItems = getNavItems(role);

  useEffect(() => {
    initTheme();
    setThemeState(getTheme());
  }, []);

  useEffect(() => {
    let ignore = false;
    api.getRagStats()
      .then((stats) => {
        if (ignore) return;
        setRagReady(Boolean(stats.ready));
        setRagChunks(Number(stats.chunk_count || 0));
      })
      .catch(() => { if (!ignore) { setRagReady(false); setRagChunks(0); } });
    return () => { ignore = true; };
  }, []);

  const handleLangChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (!user) return;
    try { await updateProfile({ language: e.target.value as typeof LANGUAGES[number] }); }
    catch { alert("Could not save your language preference."); }
  };

  const handleLogout = () => { clearUser(); router.push("/"); };

  const handleNewSession = async () => {
    const sid = typeof window !== "undefined" ? localStorage.getItem("sakhi_chat_session_id") : null;
    if (sid) { try { await api.clearChat(sid); } catch { /* ok */ } localStorage.removeItem("sakhi_chat_session_id"); }
    router.push("/chat");
    router.refresh();
  };

  const handleToggleTheme = () => { const next = toggleTheme(); setThemeState(next); };
  const isDark = theme === "dark";

  // Role badge colours
  const roleBadgeStyle: React.CSSProperties = {
    display: "inline-flex", alignItems: "center", gap: 6,
    padding: "4px 10px", borderRadius: 99, fontSize: 11, fontWeight: 700,
    background: accent + "18", color: accent, border: `1px solid ${accent}30`,
    letterSpacing: "0.04em", textTransform: "uppercase",
  };

  return (
    <aside className="sidebar" style={{ overflowY: "auto" }}>

      {/* ── Logo ── */}
      <div className="sidebar-logo">
        <span style={{ fontSize: 22 }}>🌸</span>
        <span>AI Sakhi</span>
      </div>

      {/* ── Role Badge + User Info ── */}
      {user && (
        <div style={{ padding: "10px 8px", background: "var(--bg-app)", borderRadius: "var(--radius-md)", marginBottom: 12, border: `1px solid ${accent}25` }}>
          <div style={roleBadgeStyle}>{cfg.emoji} {cfg.label}</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginTop: 6 }}>{user.name}</div>
          {role === "student" && (
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>Class {user.class_} · {user.weak_subject || "All subjects"}</div>
          )}
          {(role === "teacher" || role === "admin") && (
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{user.organization_name || "Demo School"}</div>
          )}
        </div>
      )}

      {/* ── Quick action button ── */}
      {role === "student" && (
        <button className="btn btn-primary btn-full" style={{ marginBottom: 12, justifyContent: "center", background: `linear-gradient(135deg, #064e3b, #0d9488)`, border: "none" }} onClick={handleNewSession}>
          <Plus size={15} /> New Chat
        </button>
      )}
      {role === "teacher" && (
        <button className="btn btn-full" style={{ marginBottom: 12, justifyContent: "center", background: "linear-gradient(135deg, #4c1d95, #7c3aed)", color: "white", border: "none", borderRadius: "var(--radius-md)", padding: "10px 14px", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontFamily: "Inter, sans-serif" }}
          onClick={() => router.push("/teacher")}>
          <Plus size={15} /> New Assignment
        </button>
      )}
      {role === "admin" && (
        <button className="btn btn-full" style={{ marginBottom: 12, justifyContent: "center", background: "linear-gradient(135deg, #881337, #e11d48)", color: "white", border: "none", borderRadius: "var(--radius-md)", padding: "10px 14px", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontFamily: "Inter, sans-serif" }}
          onClick={() => router.push("/admin")}>
          <Shield size={15} /> Admin Console
        </button>
      )}

      <div className="sidebar-divider" />

      {/* ── Navigation ── */}
      <div className="sidebar-section-label">Navigation</div>
      <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {navItems.map(({ href, icon: Icon, label }) => (
          <Link key={href} href={href} className={`nav-item ${path === href ? "active" : ""}`}
            style={path === href ? { background: accent + "18", color: accent, borderLeft: `3px solid ${accent}` } : {}}>
            <Icon size={16} />
            {label}
          </Link>
        ))}
      </nav>

      <div className="sidebar-divider" />

      {/* ── Language (for all roles) ── */}
      <div style={{ marginBottom: 12 }}>
        <div className="sidebar-section-label" style={{ paddingTop: 0 }}>Language</div>
        <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
          <Globe size={14} style={{ position: "absolute", left: 10, color: "var(--text-muted)", pointerEvents: "none" }} />
          <select className="input input-select" value={user?.language || "English"} onChange={handleLangChange}
            style={{ paddingLeft: 30, paddingTop: 0, paddingBottom: 0, fontSize: 13, height: 36, borderRadius: "var(--radius-md)", borderColor: accent + "40" }}>
            {LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
      </div>

      {/* ── Accessibility ── */}
      <div style={{ marginBottom: 12 }}>
        <div className="sidebar-section-label" style={{ paddingTop: 0 }}>Accessibility</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {/* Dark Mode */}
          <button onClick={handleToggleTheme} style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "7px 10px", borderRadius: "var(--radius-md)",
            border: `1.5px solid ${isDark ? "#6366f1" : "var(--border)"}`,
            background: isDark ? "#1e1b4b" : "white", cursor: "pointer", fontSize: 12, fontWeight: 500,
            color: isDark ? "#a5b4fc" : "var(--text-secondary)", fontFamily: "Inter, sans-serif", transition: "all 0.15s",
          }}>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {isDark ? <Moon size={13} /> : <Sun size={13} />} Dark Mode
            </span>
            <span style={{ width: 28, height: 16, borderRadius: 99, display: "flex", alignItems: "center", background: isDark ? "#6366f1" : "#d1d5db", padding: "0 2px", transition: "background 0.2s" }}>
              <span style={{ width: 12, height: 12, borderRadius: "50%", background: "white", transform: isDark ? "translateX(12px)" : "translateX(0)", transition: "transform 0.2s" }} />
            </span>
          </button>

          {/* Dyslexia Mode */}
          <button onClick={toggleDyslexia} style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "7px 10px", borderRadius: "var(--radius-md)",
            border: `1.5px solid ${dyslexiaMode ? "#f59e0b" : "var(--border)"}`,
            background: dyslexiaMode ? "#fef3c7" : "white", cursor: "pointer", fontSize: 12, fontWeight: 500,
            color: dyslexiaMode ? "#92400e" : "var(--text-secondary)", fontFamily: "Inter, sans-serif", transition: "all 0.15s",
          }}>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>👁 Dyslexia Mode</span>
            <span style={{ width: 28, height: 16, borderRadius: 99, display: "flex", alignItems: "center", background: dyslexiaMode ? "#f59e0b" : "#d1d5db", padding: "0 2px", transition: "background 0.2s" }}>
              <span style={{ width: 12, height: 12, borderRadius: "50%", background: "white", transform: dyslexiaMode ? "translateX(12px)" : "translateX(0)", transition: "transform 0.2s" }} />
            </span>
          </button>

          {/* Font Size */}
          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)", flexShrink: 0 }}>A</span>
            {(["sm", "md", "lg"] as const).map((s) => (
              <button key={s} onClick={() => setFontSize(s)} style={{
                flex: 1, padding: "4px 0", borderRadius: "var(--radius-sm)",
                border: `1.5px solid ${fontSize === s ? accent : "var(--border)"}`,
                background: fontSize === s ? accent + "18" : "white", cursor: "pointer",
                fontSize: s === "sm" ? 10 : s === "lg" ? 15 : 12, fontWeight: 600,
                color: fontSize === s ? accent : "var(--text-muted)", fontFamily: "Inter, sans-serif", transition: "all 0.15s",
              }}>A{s === "sm" ? "−" : s === "lg" ? "+" : ""}</button>
            ))}
          </div>
        </div>
      </div>

      {/* ── RAG status (student + admin only) ── */}
      {(role === "student" || role === "admin") && (
        <>
          <div className="sidebar-divider" />
          <div style={{ padding: "8px", background: "var(--bg-app)", borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)", marginBottom: 8 }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 2, fontWeight: 600 }}>NCERT RAG</div>
            <div style={{ fontSize: 12, color: ragReady ? "#059669" : "var(--text-secondary)" }}>
              {ragReady === null ? "Checking…" : ragReady ? `✓ ${ragChunks} chunks ready` : "Not loaded · Run ingest.py"}
            </div>
          </div>
        </>
      )}

      <div className="sidebar-divider" />

      {/* ── Bottom actions ── */}
      <div className="sidebar-bottom" style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <div style={{ display: "flex", gap: 6, marginBottom: 4 }}>
          <Link href="/profile" className={`nav-item ${path === "/profile" ? "active" : ""}`} style={{ flex: 1 }}>
            <User size={15} /> Profile
          </Link>
          <NotificationCenter />
        </div>
        <button className="nav-item" onClick={handleLogout} style={{ color: "#dc2626" }}>
          <LogOut size={15} /> Sign Out
        </button>
      </div>
    </aside>
  );
}
