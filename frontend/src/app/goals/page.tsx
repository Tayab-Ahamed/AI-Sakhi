"use client";

import { FormEvent, useEffect, useState } from "react";
import { CheckCircle2, Clock3, Plus, Target, Trash2 } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import { api } from "@/lib/api";
import { useRequireAuth } from "@/lib/auth";

type Goal = {
  id: number;
  title: string;
  target_minutes: number;
  progress_minutes: number;
  target_date?: string;
  status: "active" | "completed";
};

export default function GoalsPage() {
  const { user, isReady } = useRequireAuth(["student"]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [title, setTitle] = useState("");
  const [minutes, setMinutes] = useState(30);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    if (!user?.user_id) return;
    const result = await api.getGoals(user.user_id) as { goals?: Goal[] };
    setGoals(result.goals || []);
  };

  useEffect(() => { load().catch(() => setError("Could not load your goals.")); }, [user?.user_id]); // eslint-disable-line react-hooks/exhaustive-deps

  const create = async (event: FormEvent) => {
    event.preventDefault();
    if (!user?.user_id || title.trim().length < 3) return;
    setBusy(true); setError("");
    try {
      await api.createGoal({ user_id: user.user_id, title: title.trim(), target_minutes: minutes });
      setTitle(""); setMinutes(30); await load();
    } catch { setError("Could not create this goal."); }
    finally { setBusy(false); }
  };

  const checkIn = async (goal: Goal, value: number) => {
    if (!user?.user_id) return;
    await api.checkinGoal(goal.id, { user_id: user.user_id, minutes: value, note: "Focus session" });
    await load();
  };

  const remove = async (goal: Goal) => {
    if (!user?.user_id) return;
    await api.deleteGoal(goal.id, user.user_id); await load();
  };

  if (!isReady || !user) return null;

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main-content" style={{ padding: "32px 40px" }}>
        <div style={{ maxWidth: 920, margin: "0 auto" }}>
          <header style={{ marginBottom: 28 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <Target size={24} color="#059669" />
              <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0 }}>Learning Goals</h1>
            </div>
            <p style={{ color: "var(--text-secondary)", margin: 0 }}>Turn your study plan into small, measurable wins.</p>
          </header>

          <form onSubmit={create} className="card" style={{ padding: 20, display: "grid", gridTemplateColumns: "1fr 150px auto", gap: 12, marginBottom: 24 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 7, fontSize: 12, fontWeight: 700 }}>
              GOAL
              <input className="input" value={title} maxLength={160} onChange={(e) => setTitle(e.target.value)} placeholder="Master linear equations" />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 7, fontSize: 12, fontWeight: 700 }}>
              MINUTES
              <input className="input" type="number" min={5} max={600} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} />
            </label>
            <button className="btn btn-primary" disabled={busy || title.trim().length < 3} style={{ alignSelf: "end", minHeight: 44 }}>
              <Plus size={16} /> Add goal
            </button>
          </form>

          {error && <div style={{ padding: 12, border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", borderRadius: 8, marginBottom: 16 }}>{error}</div>}

          <section style={{ display: "grid", gap: 14 }}>
            {goals.length === 0 && (
              <div className="card" style={{ padding: 36, textAlign: "center", color: "var(--text-secondary)" }}>
                <Target size={30} style={{ marginBottom: 10, opacity: 0.45 }} />
                <div style={{ fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>No goals yet</div>
                Add one focused goal to begin.
              </div>
            )}
            {goals.map((goal) => {
              const pct = Math.min(100, Math.round((goal.progress_minutes / goal.target_minutes) * 100));
              return (
                <article key={goal.id} className="card" style={{ padding: 20, borderColor: goal.status === "completed" ? "#a7f3d0" : undefined }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 750, marginBottom: 10 }}>
                        {goal.status === "completed" ? <CheckCircle2 size={18} color="#059669" /> : <Clock3 size={18} color="#0d9488" />}
                        {goal.title}
                      </div>
                      <div style={{ height: 8, borderRadius: 8, background: "var(--border-subtle)", overflow: "hidden", marginBottom: 8 }}>
                        <div style={{ width: `${pct}%`, height: "100%", background: goal.status === "completed" ? "#46a171" : "#2783de", transition: "width .2s" }} />
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{goal.progress_minutes} of {goal.target_minutes} minutes · {pct}%</div>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      {goal.status !== "completed" && <button className="btn btn-sm" onClick={() => checkIn(goal, 10)}>+10 min</button>}
                      <button className="btn btn-sm" aria-label={`Delete ${goal.title}`} onClick={() => remove(goal)}><Trash2 size={14} /></button>
                    </div>
                  </div>
                </article>
              );
            })}
          </section>
        </div>
      </main>
    </div>
  );
}
