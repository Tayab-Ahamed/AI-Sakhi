"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { api } from "@/lib/api";
import { useUser } from "@/lib/user-context";
import { Users, Building2, Shield, Trash2, RefreshCw, BarChart2, BookOpen } from "lucide-react";

type OrgUser = {
  id: number; name: string; role: string; class_: string;
  language: string; weak_subject: string; organization_id: number;
};

const ROLES = ["student", "teacher", "parent", "admin"];

export default function AdminPage() {
  const router = useRouter();
  const { user, isReady } = useUser();
  const [users, setUsers] = useState<OrgUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  useEffect(() => {
    if (isReady && !user) router.push("/onboard");
    if (isReady && user && user.role !== "admin") router.push("/dashboard");
  }, [isReady, user, router]);

  useEffect(() => {
    if (!user?.organization_id) return;
    void loadUsers();
  }, [user?.organization_id]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/users?organization_id=${user?.organization_id}`
      );
      const data = await res.json();
      setUsers(data.users || []);
    } catch {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const changeRole = async (userId: number, newRole: string) => {
    setUpdatingId(userId);
    try {
      await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/users/${userId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: newRole }),
        }
      );
      setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, role: newRole } : u));
    } catch {
      alert("Could not update role.");
    } finally {
      setUpdatingId(null);
    }
  };

  const filtered = users.filter((u) => {
    const matchesSearch = u.name?.toLowerCase().includes(search.toLowerCase());
    const matchesRole = roleFilter === "all" || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const roleCounts = ROLES.reduce((acc, r) => {
    acc[r] = users.filter((u) => u.role === r).length;
    return acc;
  }, {} as Record<string, number>);

  const ROLE_COLORS: Record<string, { bg: string; color: string }> = {
    admin:   { bg: "#fce7f3", color: "#9d174d" },
    teacher: { bg: "#ede9fe", color: "#5b21b6" },
    parent:  { bg: "#fef3c7", color: "#92400e" },
    student: { bg: "#d1fae5", color: "#065f46" },
  };

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main-content" style={{ overflowY: "auto", padding: "28px 32px" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.4px", marginBottom: 4 }}>
                Admin Console 🛡️
              </h1>
              <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
                Manage users, roles, and organisation settings.
              </p>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={() => void loadUsers()}>
              <RefreshCw size={13} /> Refresh
            </button>
          </div>

          {/* Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 24 }}>
            {[
              { label: "Total Users", value: users.length, icon: Users, color: "#0d9488" },
              { label: "Teachers",    value: roleCounts.teacher || 0, icon: BookOpen, color: "#6366f1" },
              { label: "Students",    value: roleCounts.student || 0, icon: BarChart2, color: "#059669" },
              { label: "Admins",      value: roleCounts.admin || 0,   icon: Shield,   color: "#e11d48" },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="card" style={{ padding: "14px 16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                  <Icon size={13} style={{ color }} />
                  <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>{label}</span>
                </div>
                <div style={{ fontSize: 24, fontWeight: 800 }}>{value}</div>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
            <input
              className="input" placeholder="Search by name…"
              value={search} onChange={(e) => setSearch(e.target.value)}
              style={{ flex: 1 }}
            />
            <select className="input input-select" value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)} style={{ width: 140 }}>
              <option value="all">All roles</option>
              {ROLES.map((r) => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}s</option>)}
            </select>
          </div>

          {/* Users table */}
          {loading ? (
            <div style={{ textAlign: "center", padding: 60, color: "var(--text-muted)" }}>Loading users…</div>
          ) : (
            <div className="card" style={{ overflow: "hidden" }}>
              <table className="lb-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Class</th>
                    <th>Language</th>
                    <th>Weak Subject</th>
                    <th>Role</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={5} style={{ textAlign: "center", color: "var(--text-muted)", padding: 32 }}>No users found</td></tr>
                  ) : filtered.map((u) => {
                    const badge = ROLE_COLORS[u.role] || ROLE_COLORS.student;
                    return (
                      <motion.tr key={u.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                        <td style={{ fontWeight: 600 }}>{u.name}</td>
                        <td>{u.class_ || "–"}</td>
                        <td>{u.language || "English"}</td>
                        <td style={{ color: "var(--text-secondary)" }}>{u.weak_subject || "–"}</td>
                        <td>
                          <select
                            value={u.role || "student"}
                            onChange={(e) => void changeRole(u.id, e.target.value)}
                            disabled={updatingId === u.id || u.id === user?.user_id}
                            style={{
                              padding: "3px 8px", borderRadius: 8, fontSize: 12,
                              fontWeight: 600, border: `1.5px solid ${badge.color}40`,
                              background: badge.bg, color: badge.color,
                              cursor: u.id === user?.user_id ? "not-allowed" : "pointer",
                              fontFamily: "Inter, sans-serif",
                            }}
                          >
                            {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                          </select>
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
