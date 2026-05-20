"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { useUser } from "@/lib/user-context";
import { RefreshCw } from "lucide-react";

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
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>📊 Topic Mastery</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: 14, marginBottom: 28 }}>Based on your quiz history. Focus on red topics first!</p>

          {loading ? (
            <div style={{ textAlign: "center", padding: 60, color: "var(--text-muted)" }}>Loading mastery data…</div>
          ) : data.length === 0 ? (
            <div className="card" style={{ padding: 40, textAlign: "center" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🎯</div>
              <p style={{ color: "var(--text-secondary)" }}>No quiz data yet. Complete some quizzes to see your mastery!</p>
              <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => router.push("/quiz")}>Start a Quiz</button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {data.map((item) => (
                <div key={item.topic} className="card" style={{ padding: "14px 18px", display: "flex", alignItems: "center", gap: 14 }}>
                  <span style={{ fontSize: 18, width: 24 }}>{emoji(item.avg_pct)}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{ fontWeight: 600, fontSize: 14, color: "var(--text-primary)" }}>{item.topic}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: item.avg_pct >= 70 ? "#10b981" : item.avg_pct >= 40 ? "#f59e0b" : "#ef4444" }}>{item.avg_pct}%</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div className="mastery-bar-track">
                        <div className={`mastery-bar-fill ${colorClass(item.avg_pct)}`} style={{ width: `${item.avg_pct}%` }} />
                      </div>
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>{item.attempts} attempt{item.attempts !== 1 ? "s" : ""}</div>
                  </div>
                  <button
                    className="btn btn-secondary"
                    style={{ fontSize: 12, padding: "6px 12px", gap: 4, flexShrink: 0 }}
                    onClick={() => router.push(`/quiz?topic=${encodeURIComponent(item.topic)}`)}
                  >
                    <RefreshCw size={12} /> Practice
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
