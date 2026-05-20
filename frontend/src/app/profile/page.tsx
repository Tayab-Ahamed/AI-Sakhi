"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import XPBar from "@/components/XPBar";
import { useUser } from "@/lib/user-context";
import { Edit2, Check, X } from "lucide-react";
import { api } from "@/lib/api";

const LANGUAGES = ["English", "Hinglish", "Hindi", "Kannada", "Tamil"];

export default function ProfilePage() {
  const { user, updateProfile, isReady } = useUser();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: "", language: "English", weak_subject: "" });
  const [progress, setProgress] = useState<{ streak: number; history: any[] }>({ streak: 0, history: [] });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isReady && !user) router.push("/onboard");
    if (user) {
      setForm({ name: user.name, language: user.language || "English", weak_subject: user.weak_subject || "" });
      api.getProgress(user.user_id).then((d: any) => setProgress(d)).catch(() => {});
    }
  }, [user, isReady, router]);

  if (!user) return null;

  const avgScore = progress.history.length
    ? Math.round(progress.history.reduce((s: number, r: any) => s + (r.score / r.total) * 100, 0) / progress.history.length)
    : 0;

  const initials = user.name.split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase();

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateProfile(form as any);
      setEditing(false);
    } catch {
      alert("Could not save changes.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content" style={{ overflowY: "auto", padding: "32px 28px" }}>
        <div style={{ maxWidth: 640, margin: "0 auto" }}>

          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 28 }}>
            <div className="profile-avatar">{initials}</div>
            <div style={{ flex: 1 }}>
              <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)" }}>{user.name}</h1>
              <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>{user.role} · Class {user.class_} · {user.language}</p>
            </div>
            <button
              className="btn btn-secondary"
              style={{ gap: 6 }}
              onClick={() => { if (editing) handleSave(); else setEditing(true); }}
              disabled={saving}
            >
              {editing ? <><Check size={14} /> Save</> : <><Edit2 size={14} /> Edit</>}
            </button>
            {editing && (
              <button className="btn btn-ghost" onClick={() => setEditing(false)} title="Cancel">
                <X size={14} />
              </button>
            )}
          </div>

          {/* Edit form */}
          {editing && (
            <div className="card" style={{ padding: 20, marginBottom: 24 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>Edit Profile</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Name</label>
                  <input className="input" value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Preferred Language</label>
                  <select className="input" value={form.language} onChange={(e) => setForm(f => ({ ...f, language: e.target.value }))} style={{ cursor: "pointer" }}>
                    {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Weak Subject</label>
                  <input className="input" value={form.weak_subject} onChange={(e) => setForm(f => ({ ...f, weak_subject: e.target.value }))} placeholder="e.g. Mathematics" />
                </div>
              </div>
            </div>
          )}

          {/* Stats grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
            <div className="stat-card">
              <div className="stat-card-value">🔥 {progress.streak}</div>
              <div className="stat-card-label">Day Streak</div>
            </div>
            <div className="stat-card">
              <div className="stat-card-value">{progress.history.length}</div>
              <div className="stat-card-label">Quizzes Done</div>
            </div>
            <div className="stat-card">
              <div className="stat-card-value">{avgScore}%</div>
              <div className="stat-card-label">Avg Score</div>
            </div>
          </div>

          {/* XP Bar */}
          <div style={{ marginBottom: 20 }}>
            <XPBar userId={user.user_id} />
          </div>

          {/* Info card */}
          <div className="card" style={{ padding: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 14, color: "var(--text-primary)" }}>Account Details</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                ["Class", `Class ${user.class_}`],
                ["Role", user.role],
                ["Language", user.language || "English"],
                ["Weak Subject", user.weak_subject || "Not set"],
                ["Organisation", user.organization_name || "Demo School"],
              ].map(([label, val]) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", fontSize: 14, borderBottom: "1px solid var(--border-subtle)", paddingBottom: 8 }}>
                  <span style={{ color: "var(--text-secondary)" }}>{label}</span>
                  <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>{val}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
