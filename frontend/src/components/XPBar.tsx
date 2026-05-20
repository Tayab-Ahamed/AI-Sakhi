"use client";

import { useEffect, useState } from "react";
import { Star } from "lucide-react";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type XPData = {
  xp: number;
  level: number;
  level_name: string;
  next_level_xp: number | null;
  progress_pct: number;
};

export default function XPBar({ userId }: { userId: number }) {
  const [data, setData] = useState<XPData | null>(null);

  useEffect(() => {
    fetch(`${BASE_URL}/gamification/xp/${userId}`, { credentials: "include" })
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  }, [userId]);

  if (!data) return null;

  const badgeClass = data.level_name.toLowerCase();

  return (
    <div style={{ padding: "16px", background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Star size={16} style={{ color: "#f59e0b" }} />
          <span style={{ fontWeight: 700, fontSize: 14, color: "var(--text-primary)" }}>XP &amp; Level</span>
        </div>
        <span className={`level-badge ${badgeClass}`}>{data.level_name}</span>
      </div>
      <div className="xp-bar-track">
        <div className="xp-bar-fill" style={{ width: `${Math.min(data.progress_pct, 100)}%` }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 12, color: "var(--text-secondary)" }}>
        <span>{data.xp} XP</span>
        <span>{data.next_level_xp ? `${data.next_level_xp} XP for next level` : "Max level reached! 🏆"}</span>
      </div>
    </div>
  );
}
