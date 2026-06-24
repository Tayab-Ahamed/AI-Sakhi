"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Sidebar from "@/components/Sidebar";
import { api } from "@/lib/api";
import { useUser } from "@/lib/user-context";
import { Trophy, Zap, Flame, Star } from "lucide-react";

type LeaderUser = {
  user_id: number;
  name: string;
  class_: string;
  role: string;
  organization_name?: string;
};

type LeaderEntry = {
  user_id: number;
  name: string;
  class_: string;
  role: string;
  org: string;
  xp: number;
  streak: number;
  quizzes: number;
  avg: number;
};

const RANK_EMOJI = ["🥇", "🥈", "🥉"];

export default function LeaderboardPage() {
  const { user } = useUser();
  const [entries, setEntries] = useState<LeaderEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"xp" | "streak" | "quizzes">("xp");


  useEffect(() => {
    if (!user?.organization_id) return;
    const load = async () => {
      try {
        // Use the dedicated leaderboard endpoint (single query, no N+1)
        const data = await api.getLeaderboard(user.organization_id!) as {
          leaderboard?: Array<{
            user_id: number; name: string; class_: string;
            xp: number; streak: number; quiz_count: number; avg_pct: number;
          }>;
        };
        if (data.leaderboard && data.leaderboard.length > 0) {
          const mapped: LeaderEntry[] = data.leaderboard.map((e) => ({
            user_id: e.user_id,
            name: e.name,
            class_: e.class_,
            role: "student",
            org: user.organization_name || "Demo School",
            xp: e.xp,
            streak: e.streak,
            quizzes: e.quiz_count,
            avg: Math.round(e.avg_pct),
          }));
          setEntries(mapped);
        }
      } catch {
        // Fallback: fetch dashboard + individual progress (N+1 — kept as backup)
        try {
          const dashboard = await api.getDashboard(user?.organization_id) as { users?: LeaderUser[] };
          const users: LeaderUser[] = dashboard.users || [];
          const studentUsers = users.filter((u) => u.role === "student");
          const enriched = await Promise.all(
            studentUsers.map(async (u) => {
              try {
                const prog = await api.getProgress(u.user_id) as { history?: Array<{ score: number; total: number; streak: number }>; streak?: number };
                const history = prog.history || [];
                const streak = prog.streak || 0;
                const quizzes = history.length;
                const xp = quizzes * 50 + streak * 20;
                const avg = quizzes
                  ? Math.round(history.reduce((a, h) => a + (h.score / h.total) * 100, 0) / quizzes) : 0;
                return { user_id: u.user_id, name: u.name, class_: u.class_, role: u.role, org: u.organization_name || "Demo School", xp, streak, quizzes, avg };
              } catch {
                return { user_id: u.user_id, name: u.name, class_: u.class_, role: u.role, org: "Demo School", xp: 0, streak: 0, quizzes: 0, avg: 0 };
              }
            })
          );
          setEntries(enriched);
        } catch { /* silent */ }
      } finally {
        setLoading(false);
      }
    };
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.organization_id]);

  const sorted = [...entries].sort((a, b) => b[filter] - a[filter]);

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main-content" style={{ overflowY: "auto" }}>
        <div style={{ maxWidth: 760, margin: "0 auto", padding: "32px 24px" }}>

          {/* Header */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: "#fefce8", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Trophy size={18} style={{ color: "#ca8a04" }} />
              </div>
              <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.3px" }}>Leaderboard</h1>
            </div>
            <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
              Top learners in {user?.organization_name || "Demo School"} · Ranked by {filter}
            </p>
          </div>

          {/* Filter tabs */}
          <div style={{ display: "flex", gap: 8, marginBottom: 20, background: "#f3f4f6", borderRadius: 12, padding: 4 }}>
            {(["xp", "streak", "quizzes"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  flex: 1, padding: "8px 0", borderRadius: 9, border: "none",
                  background: filter === f ? "white" : "transparent",
                  boxShadow: filter === f ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
                  fontWeight: filter === f ? 700 : 500, fontSize: 13,
                  color: filter === f ? "var(--emerald)" : "var(--text-secondary)",
                  cursor: "pointer", fontFamily: "Inter, sans-serif", transition: "all 0.2s",
                }}
              >
                {f === "xp" ? "⭐ XP" : f === "streak" ? "🔥 Streak" : "📝 Quizzes"}
              </button>
            ))}
          </div>

          {/* Top 3 podium */}
          {sorted.length >= 3 && (
            <div style={{ display: "flex", gap: 12, marginBottom: 24, alignItems: "flex-end" }}>
              {[1, 0, 2].map((rank) => {
                const e = sorted[rank];
                const isMe = e?.user_id === user?.user_id;
                const heights = ["80px", "110px", "64px"];
                return (
                  <motion.div
                    key={rank}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: rank * 0.1 }}
                    style={{
                      flex: 1, textAlign: "center", background: isMe ? "#f0fdf4" : "white",
                      border: `1.5px solid ${isMe ? "#22c55e" : "var(--border-subtle)"}`,
                      borderRadius: 16, padding: "16px 8px 14px",
                      boxShadow: rank === 0 ? "0 4px 20px rgba(202,138,4,0.15)" : "none",
                    }}
                  >
                    <div style={{ fontSize: 28, marginBottom: 4 }}>{RANK_EMOJI[rank]}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2, color: "var(--text-primary)" }}>
                      {e?.name || "—"}{isMe ? " 👤" : ""}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 10 }}>Class {e?.class_}</div>
                    <div style={{
                      width: "60%", margin: "0 auto",
                      height: heights[rank],
                      background: rank === 0 ? "linear-gradient(180deg,#fbbf24,#f59e0b)" : rank === 1 ? "linear-gradient(180deg,#d1d5db,#9ca3af)" : "linear-gradient(180deg,#cd7c35,#b45309)",
                      borderRadius: "6px 6px 0 0",
                    }} />
                    <div style={{ fontSize: 18, fontWeight: 800, color: rank === 0 ? "#ca8a04" : "var(--text-primary)", marginTop: 8 }}>
                      {filter === "xp" ? `${e?.[filter] || 0} XP` : filter === "streak" ? `${e?.[filter] || 0}🔥` : `${e?.[filter] || 0} Q`}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}

          {/* Full table */}
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            {loading ? (
              <div style={{ padding: "40px", textAlign: "center" }}>
                <div style={{ width: 28, height: 28, border: "3px solid #e5e7eb", borderTopColor: "var(--emerald)", borderRadius: "50%", animation: "spin 0.7s linear infinite", margin: "0 auto 12px" }} />
                <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Loading leaderboard...</p>
              </div>
            ) : sorted.length === 0 ? (
              <div style={{ padding: "48px", textAlign: "center" }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🏆</div>
                <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 4 }}>No student data yet</p>
                <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Complete quizzes to appear on the leaderboard!</p>
              </div>
            ) : (
              <table className="lb-table">
                <thead>
                  <tr>
                    <th style={{ width: 48 }}>#</th>
                    <th>Student</th>
                    <th>Class</th>
                    <th style={{ textAlign: "right" }}>
                      <span style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 4 }}>
                        <Star size={11} /> XP
                      </span>
                    </th>
                    <th style={{ textAlign: "right" }}>
                      <span style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 4 }}>
                        <Flame size={11} /> Streak
                      </span>
                    </th>
                    <th style={{ textAlign: "right" }}>
                      <span style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 4 }}>
                        <Zap size={11} /> Quizzes
                      </span>
                    </th>
                    <th style={{ textAlign: "right" }}>Avg %</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((e, i) => {
                    const isMe = e.user_id === user?.user_id;
                    return (
                      <motion.tr
                        key={e.user_id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.04 }}
                        className={isMe ? "lb-me" : ""}
                      >
                        <td>
                          <span className={i === 0 ? "lb-rank-1" : i === 1 ? "lb-rank-2" : i === 2 ? "lb-rank-3" : ""}>
                            {i < 3 ? RANK_EMOJI[i] : i + 1}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontWeight: isMe ? 700 : 500 }}>
                            {e.name} {isMe && <span style={{ fontSize: 11, color: "var(--emerald)", fontWeight: 700 }}>YOU</span>}
                          </span>
                        </td>
                        <td style={{ color: "var(--text-muted)" }}>Class {e.class_}</td>
                        <td style={{ textAlign: "right", fontWeight: 700, color: "var(--emerald)" }}>{e.xp}</td>
                        <td style={{ textAlign: "right" }}>{e.streak > 0 ? `${e.streak} 🔥` : "—"}</td>
                        <td style={{ textAlign: "right" }}>{e.quizzes || "—"}</td>
                        <td style={{ textAlign: "right", color: e.avg >= 80 ? "#16a34a" : e.avg >= 60 ? "#ca8a04" : e.avg > 0 ? "#dc2626" : "var(--text-muted)" }}>
                          {e.avg > 0 ? `${e.avg}%` : "—"}
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Your rank highlight */}
          {!loading && user && sorted.findIndex((e) => e.user_id === user.user_id) > -1 && (
            <div style={{ marginTop: 16, padding: "14px 18px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 12, fontSize: 13, color: "#065f46" }}>
              🎯 You are ranked <strong>#{sorted.findIndex((e) => e.user_id === user.user_id) + 1}</strong> out of {sorted.length} students.
              {sorted[0]?.user_id !== user.user_id && (
                <span> Keep going to reach the top! 💪</span>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
