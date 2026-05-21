"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Sidebar from "@/components/Sidebar";
import { useUser } from "@/lib/user-context";
import { RefreshCw, Trophy, BookOpen, AlertTriangle } from "lucide-react";

type TopicMastery = {
  topic: string;
  attempts: number;
  avg_pct: number;
  last_attempted: string;
};

export default function MasteryPage() {
  const { user, isReady } = useUser();
  const router = useRouter();
  const [data, setData] = useState<TopicMastery[]>([]);
  const [loading, setLoading] = useState(true);
  const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  useEffect(() => {
    if (isReady && !user) { router.push("/onboard"); return; }
    if (!user) return;
    fetch(`${BASE_URL}/analytics/mastery/${user.user_id}`, { credentials: "include" })
      .then(r => r.json())
      .then(d => { setData(d.mastery || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [user, isReady, router, BASE_URL]);

  const colorClass = (pct: number) => pct >= 70 ? "green" : pct >= 40 ? "yellow" : "red";
  const emoji = (pct: number) => pct >= 70 ? "✅" : pct >= 40 ? "⚡" : "🔴";

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content" style={{ overflowY: "auto", padding: "32px 28px" }}>
        <div style={{ maxWidth: 700, margin: "0 auto" }}>
          <div style={{ marginBottom: 24 }}>
            <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.5px", display: "flex", alignItems: "center", gap: 10, margin: 0 }}>
              📊 Subject &amp; Topic Mastery
            </h1>
            <p style={{ color: "var(--text-secondary)", fontSize: 14, marginTop: 4, marginBottom: 0 }}>
              Dynamic performance analytics based on your quiz answers. Revise weaker topics to earn bonus XP!
            </p>
          </div>

          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 80 }}>
              <div style={{ width: 32, height: 32, border: "3px solid #e5e7eb", borderTopColor: "var(--emerald)", borderRadius: "50%", animation: "spin 0.7s linear infinite", marginBottom: 12 }} />
              <p style={{ fontSize: 14, color: "var(--text-muted)", margin: 0 }}>Analyzing mastery records...</p>
            </div>
          ) : data.length === 0 ? (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="card" style={{ padding: 48, textAlign: "center", border: "1px dashed var(--border)" }}>
              <div style={{ fontSize: 44, marginBottom: 16 }}>🎯</div>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>No mastery data available yet</h3>
              <p style={{ color: "var(--text-secondary)", fontSize: 14, maxWidth: 400, margin: "0 auto 20px" }}>
                Complete your first personalized topic quiz so Sakhi can calculate your subject strengths!
              </p>
              <button className="btn btn-primary" onClick={() => router.push("/quiz")}>Start First Quiz</button>
            </motion.div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {/* Summary Stats Grid */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                <div className="card" style={{ padding: 18, display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: "#ecfdf5", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Trophy size={18} style={{ color: "#10b981" }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.03em" }}>Strongest Topic</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginTop: 2 }}>
                      {(() => {
                        const sorted = [...data].sort((a, b) => b.avg_pct - a.avg_pct);
                        return sorted[0] ? `${sorted[0].topic} (${sorted[0].avg_pct}%)` : "N/A";
                      })()}
                    </div>
                  </div>
                </div>

                <div className="card" style={{ padding: 18, display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: "#fef2f2", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <AlertTriangle size={18} style={{ color: "#ef4444" }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.03em" }}>Immediate Focus</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginTop: 2 }}>
                      {(() => {
                        const sorted = [...data].sort((a, b) => a.avg_pct - b.avg_pct);
                        return sorted[0] ? `${sorted[0].topic} (${sorted[0].avg_pct}%)` : "N/A";
                      })()}
                    </div>
                  </div>
                </div>
              </div>

              {/* Mastery List */}
              <AnimatePresence>
                {data.map((item, idx) => (
                  <motion.div
                    key={item.topic}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: idx * 0.05 }}
                    className="card"
                    whileHover={{ y: -2, boxShadow: "var(--shadow-md)" }}
                    style={{
                      padding: "16px 20px",
                      display: "flex",
                      alignItems: "center",
                      gap: 16,
                      borderLeft: `4px solid ${item.avg_pct >= 70 ? "#10b981" : item.avg_pct >= 40 ? "#f59e0b" : "#ef4444"}`,
                    }}
                  >
                    <span style={{ fontSize: 20, display: "flex", alignItems: "center" }}>{emoji(item.avg_pct)}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                        <span style={{ fontWeight: 700, fontSize: 14, color: "var(--text-primary)" }}>{item.topic}</span>
                        <span style={{ fontSize: 13, fontWeight: 800, color: item.avg_pct >= 70 ? "#10b981" : item.avg_pct >= 40 ? "#f59e0b" : "#ef4444" }}>
                          {item.avg_pct}%
                        </span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div className="mastery-bar-track" style={{ height: 8, background: "var(--border-subtle)", borderRadius: 4, flex: 1, overflow: "hidden", position: "relative" }}>
                          <motion.div
                            className={`mastery-bar-fill ${colorClass(item.avg_pct)}`}
                            initial={{ width: 0 }}
                            animate={{ width: `${item.avg_pct}%` }}
                            transition={{ duration: 1, delay: idx * 0.05 + 0.2, ease: "easeOut" }}
                            style={{ height: "100%", borderRadius: 4 }}
                          />
                        </div>
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 5, fontWeight: 500 }}>
                        📊 {item.attempts} quiz attempt{item.attempts !== 1 ? "s" : ""} · Last studied {item.last_attempted ? new Date(item.last_attempted).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "Recently"}
                      </div>
                    </div>
                    <button
                      className="btn btn-secondary"
                      style={{
                        fontSize: 12,
                        padding: "6px 14px",
                        gap: 6,
                        flexShrink: 0,
                        borderRadius: 20,
                        border: "1.5px solid var(--border)",
                        fontWeight: 600,
                      }}
                      onClick={() => router.push(`/quiz?topic=${encodeURIComponent(item.topic)}`)}
                    >
                      <RefreshCw size={12} /> Practice
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
