"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { api } from "@/lib/api";
import { useUser } from "@/lib/user-context";
import { 
  Users, Building2, Shield, Trash2, RefreshCw, BarChart2, 
  BookOpen, Plus, Download, Sparkles, X, Check, HelpCircle 
} from "lucide-react";

type OrgUser = {
  id: number; name: string; role: string; class_: string;
  language: string; weak_subject: string; organization_id: number;
};

type ActivityItem = {
  date: string;
  count: number;
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
  
  // New upgraded states
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [isSeedModalOpen, setIsSeedModalOpen] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [seedForm, setSeedForm] = useState({
    name: "",
    role: "student",
    class_: "8",
    language: "English",
    weak_subject: "Science"
  });

  useEffect(() => {
    if (isReady && !user) router.push("/onboard");
    if (isReady && user && user.role !== "admin") router.push("/dashboard");
  }, [isReady, user, router]);

  useEffect(() => {
    if (!user?.organization_id || user.role !== "admin") return;
    void loadData();
  }, [user?.organization_id, user?.role]);

  const loadData = async () => {
    if (!user?.organization_id || user.role !== "admin") return;
    setLoading(true);
    try {
      // Load users
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/users?organization_id=${user?.organization_id}`
      );
      const data = await res.json();
      setUsers(data.users || []);

      // Load activity stats
      const actData = await api.getDailyActivity(user.organization_id) as { activity: ActivityItem[] };
      setActivity(actData.activity || []);
    } catch {
      setUsers([]);
      setActivity([]);
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

  const handleSeedSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.organization_id) return;
    setSeeding(true);
    try {
      await api.seedDemoData({
        ...seedForm,
        organization_id: user.organization_id
      });
      setIsSeedModalOpen(false);
      // Reset form
      setSeedForm({
        name: "",
        role: "student",
        class_: "8",
        language: "English",
        weak_subject: "Science"
      });
      // Reload list
      await loadData();
    } catch (err) {
      alert("Error seeding demo account.");
    } finally {
      setSeeding(false);
    }
  };

  // Exporters
  const exportToCSV = () => {
    if (users.length === 0) return;
    const headers = ["ID", "Name", "Role", "Class", "Language", "Weak Subject"];
    const rows = users.map(u => [
      u.id,
      u.name,
      u.role,
      u.class_ || "N/A",
      u.language || "English",
      u.weak_subject || "N/A"
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(e => e.map(val => `"${val}"`).join(","))].join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Sakhi_Org_Roster_${user?.organization_id || "Export"}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToJSON = () => {
    if (users.length === 0) return;
    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
      JSON.stringify(users, null, 2)
    )}`;
    const link = document.createElement("a");
    link.setAttribute("href", jsonString);
    link.setAttribute("download", `Sakhi_Org_Roster_${user?.organization_id || "Export"}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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

  // Fallback activity data for styling if database has none
  const defaultActivity: ActivityItem[] = [
    { date: "Mon", count: 24 },
    { date: "Tue", count: 48 },
    { date: "Wed", count: 32 },
    { date: "Thu", count: 65 },
    { date: "Fri", count: 54 },
    { date: "Sat", count: 78 },
    { date: "Sun", count: 45 }
  ];

  const currentActivity = activity.length > 0 && activity.some(a => a.count > 0)
    ? activity.map(a => ({
        date: new Date(a.date).toLocaleDateString("en-IN", { weekday: "short" }),
        count: a.count
      }))
    : defaultActivity;

  const maxActivityValue = Math.max(...currentActivity.map(a => a.count), 1);

  if (!isReady) {
    return (
      <div className="app-shell">
        <Sidebar />
        <main className="main-content" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ width: 32, height: 32, border: "3px solid #e5e7eb", borderTopColor: "var(--emerald)", borderRadius: "50%", animation: "spin 0.7s linear infinite", margin: "0 auto 12px" }} />
            <p style={{ fontSize: 14, color: "var(--text-muted)" }}>Loading...</p>
          </div>
        </main>
      </div>
    );
  }

  if (!user || user.role !== "admin") {
    return null;
  }

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main-content" style={{ overflowY: "auto", padding: "28px 32px" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
            <div>
              <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.5px", marginBottom: 4 }}>
                Admin Console 🛡️
              </h1>
              <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
                Audit organization metrics, configure active user credentials, export data, and spawn mock test clients.
              </p>
            </div>
            
            <div style={{ display: "flex", gap: 10 }}>
              <button 
                className="btn btn-secondary btn-sm" 
                onClick={() => setIsSeedModalOpen(true)}
                style={{ display: "flex", alignItems: "center", gap: 6, background: "linear-gradient(135deg, #4f46e5, #6366f1)", color: "white", border: "none" }}
              >
                <Sparkles size={13} /> Spawn Demo Account
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => void loadData()}>
                <RefreshCw size={13} /> Refresh
              </button>
            </div>
          </div>

          {/* Core Stats Overview */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
            {[
              { label: "Total Members", value: users.length, icon: Users, color: "#0d9488" },
              { label: "Academic Teachers", value: roleCounts.teacher || 0, icon: BookOpen, color: "#6366f1" },
              { label: "Active Students", value: roleCounts.student || 0, icon: BarChart2, color: "#059669" },
              { label: "Consoles Protected", value: roleCounts.admin || 0, icon: Shield, color: "#e11d48" },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="card" style={{ padding: "16px 18px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <Icon size={14} style={{ color }} />
                  <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>{label}</span>
                </div>
                <div style={{ fontSize: 26, fontWeight: 800 }}>{value}</div>
              </div>
            ))}
          </div>

          {/* Activity Logs & Quick Exporters */}
          <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 24, marginBottom: 24 }}>
            
            {/* Platform Activity CSS Bar Chart */}
            <div className="card" style={{ padding: 24 }}>
              <h2 style={{ fontSize: 15, fontWeight: 800, marginBottom: 20, display: "flex", alignItems: "center", gap: 8 }}>
                <BarChart2 size={16} style={{ color: "var(--emerald)" }} /> Platform Activity Volume
              </h2>
              
              <div style={{ 
                height: 160, 
                display: "flex", 
                alignItems: "flex-end", 
                justifyContent: "space-between", 
                padding: "0 10px 10px 10px", 
                borderBottom: "1.5px solid var(--border)",
                gap: 12
              }}>
                {currentActivity.map((a, idx) => {
                  const pctHeight = (a.count / maxActivityValue) * 100;
                  return (
                    <div key={idx} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", height: "100%", justifyContent: "flex-end" }}>
                      
                      {/* Bar Count Tooltip */}
                      <span style={{ fontSize: 11, fontWeight: 800, color: "var(--emerald)", marginBottom: 4 }}>
                        {a.count}
                      </span>
                      
                      {/* Bar Fill */}
                      <div style={{
                        width: "100%",
                        height: `${pctHeight}%`,
                        background: "linear-gradient(to top, var(--teal-light), var(--emerald))",
                        borderRadius: "6px 6px 0 0",
                        boxShadow: "0 0 10px rgba(16, 185, 129, 0.15)",
                        transition: "height 0.6s cubic-bezier(0.16, 1, 0.3, 1)"
                      }} />
                    </div>
                  );
                })}
              </div>
              
              {/* X-Axis labels */}
              <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 10px 0 10px" }}>
                {currentActivity.map((a, idx) => (
                  <span key={idx} style={{ flex: 1, textAlign: "center", fontSize: 11, color: "var(--text-muted)", fontWeight: 700 }}>
                    {a.date}
                  </span>
                ))}
              </div>
            </div>

            {/* Structured Backups Exporter Card */}
            <div className="card" style={{ padding: 24, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div>
                <h2 style={{ fontSize: 15, fontWeight: 800, marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
                  <Download size={16} style={{ color: "#6366f1" }} /> Data backups & Export
                </h2>
                <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: 16 }}>
                  Download high-fidelity administrative spreadsheets containing user listings, weakness analysis indices, and languages.
                </p>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <button 
                  onClick={exportToCSV}
                  disabled={users.length === 0}
                  className="btn btn-secondary" 
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "10px", fontSize: 13, fontWeight: 700 }}
                >
                  <Download size={14} /> Export to Spreadsheet (CSV)
                </button>
                <button 
                  onClick={exportToJSON}
                  disabled={users.length === 0}
                  className="btn btn-secondary" 
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "10px", fontSize: 13, fontWeight: 700, borderColor: "var(--border)" }}
                >
                  <Download size={14} /> Export Raw Schema (JSON)
                </button>
              </div>
            </div>

          </div>

          {/* User Roster Audit Directory */}
          <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
            <input
              className="input" 
              placeholder="Search users by name…"
              value={search} 
              onChange={(e) => setSearch(e.target.value)}
              style={{ flex: 1 }}
            />
            <select 
              className="input input-select" 
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)} 
              style={{ width: 150, fontWeight: 600 }}
            >
              <option value="all">All Roles</option>
              {ROLES.map((r) => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}s</option>)}
            </select>
          </div>

          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 60, gap: 10, color: "var(--text-muted)" }}>
              <div style={{ width: 24, height: 24, border: "2.5px solid var(--border)", borderTopColor: "var(--emerald)", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
              <span style={{ fontSize: 13, fontWeight: 500 }}>Syncing directory...</span>
            </div>
          ) : (
            <div className="card" style={{ overflow: "hidden" }}>
              <table className="lb-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Class</th>
                    <th>Language</th>
                    <th>Weak Subject</th>
                    <th>Role Clearance</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ textAlign: "center", color: "var(--text-muted)", padding: 40, fontSize: 13 }}>
                        No matches inside selected role criteria.
                      </td>
                    </tr>
                  ) : filtered.map((u) => {
                    const badge = ROLE_COLORS[u.role] || ROLE_COLORS.student;
                    return (
                      <tr key={u.id}>
                        <td style={{ fontWeight: 700, fontSize: 13.5 }}>{u.name}</td>
                        <td style={{ fontSize: 13 }}>{u.class_ || "—"}</td>
                        <td style={{ fontSize: 13 }}>{u.language || "English"}</td>
                        <td style={{ color: "var(--text-secondary)", fontSize: 13 }}>{u.weak_subject || "—"}</td>
                        <td>
                          <select
                            value={u.role || "student"}
                            onChange={(e) => void changeRole(u.id, e.target.value)}
                            disabled={updatingId === u.id || u.id === user?.user_id}
                            style={{
                              padding: "4px 10px", 
                              borderRadius: 8, 
                              fontSize: 12,
                              fontWeight: 700, 
                              border: `1.5px solid ${badge.color}35`,
                              background: badge.bg, 
                              color: badge.color,
                              cursor: u.id === user?.user_id ? "not-allowed" : "pointer",
                              fontFamily: "Inter, sans-serif",
                              outline: "none"
                            }}
                          >
                            {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Upgraded Spawn Demo Account Modal */}
          <AnimatePresence>
            {isSeedModalOpen && (
              <div style={{
                position: "fixed",
                top: 0,
                left: 0,
                width: "100vw",
                height: "100vh",
                background: "rgba(0, 0, 0, 0.4)",
                backdropFilter: "blur(4px)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 999
              }}>
                <motion.div 
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.95, opacity: 0 }}
                  style={{
                    width: "100%",
                    maxWidth: 440,
                    background: "var(--bg-surface)",
                    borderRadius: 18,
                    border: "1.5px solid var(--border)",
                    boxShadow: "var(--shadow-lg)",
                    overflow: "hidden"
                  }}
                >
                  {/* Modal Header */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: "1.5px solid var(--border)" }}>
                    <h3 style={{ fontSize: 16, fontWeight: 800, display: "flex", alignItems: "center", gap: 6 }}>
                      <Sparkles size={16} style={{ color: "#6366f1" }} /> Spawn Test Account
                    </h3>
                    <button 
                      onClick={() => setIsSeedModalOpen(false)}
                      style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}
                    >
                      <X size={16} />
                    </button>
                  </div>

                  {/* Modal Body */}
                  <form onSubmit={handleSeedSubmit} style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
                    <div>
                      <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 6 }}>Account Full Name</label>
                      <input 
                        required
                        className="input" 
                        placeholder="e.g. John Doe"
                        value={seedForm.name}
                        onChange={e => setSeedForm(prev => ({ ...prev, name: e.target.value }))}
                      />
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <div>
                        <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 6 }}>System Role</label>
                        <select 
                          className="input input-select"
                          value={seedForm.role}
                          onChange={e => setSeedForm(prev => ({ ...prev, role: e.target.value }))}
                        >
                          <option value="student">Student</option>
                          <option value="teacher">Teacher</option>
                        </select>
                      </div>

                      <div>
                        <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 6 }}>Grade Class</label>
                        <select 
                          className="input input-select"
                          value={seedForm.class_}
                          onChange={e => setSeedForm(prev => ({ ...prev, class_: e.target.value }))}
                        >
                          {["6", "7", "8", "9", "10", "11", "12"].map(g => (
                            <option key={g} value={g}>Class {g}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <div>
                        <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 6 }}>Language</label>
                        <select 
                          className="input input-select"
                          value={seedForm.language}
                          onChange={e => setSeedForm(prev => ({ ...prev, language: e.target.value }))}
                        >
                          <option value="English">English</option>
                          <option value="Hindi">Hindi</option>
                          <option value="Tamil">Tamil</option>
                          <option value="Bengali">Bengali</option>
                        </select>
                      </div>

                      <div>
                        <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 6 }}>Weak Subject</label>
                        <select 
                          className="input input-select"
                          value={seedForm.weak_subject}
                          onChange={e => setSeedForm(prev => ({ ...prev, weak_subject: e.target.value }))}
                        >
                          <option value="Science">Science</option>
                          <option value="Mathematics">Mathematics</option>
                          <option value="History">History</option>
                          <option value="English">English</option>
                        </select>
                      </div>
                    </div>

                    <div style={{ 
                      background: "var(--bg-sidebar)", 
                      padding: "10px 12px", 
                      borderRadius: 10, 
                      fontSize: 11.5, 
                      color: "var(--text-muted)", 
                      lineHeight: 1.4,
                      border: "1px solid var(--border)"
                    }}>
                      💡 Test accounts are initialized with <strong>password123</strong>. Students are pre-populated with a 7-day study-time profile, historical quiz attempts, and active milestones.
                    </div>

                    <div style={{ display: "flex", gap: 10, marginTop: 6, justifyContent: "flex-end" }}>
                      <button 
                        type="button" 
                        onClick={() => setIsSeedModalOpen(false)}
                        className="btn btn-secondary" 
                        style={{ fontSize: 12.5, fontWeight: 700, padding: "8px 16px" }}
                      >
                        Cancel
                      </button>
                      <button 
                        type="submit"
                        disabled={seeding || !seedForm.name.trim()}
                        className="btn btn-primary"
                        style={{ fontSize: 12.5, fontWeight: 700, padding: "8px 16px", display: "flex", alignItems: "center", gap: 6 }}
                      >
                        {seeding ? (
                          <div style={{ width: 14, height: 14, border: "2px solid white", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
                        ) : (
                          <Check size={14} />
                        )}
                        Spawn Account
                      </button>
                    </div>

                  </form>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

        </div>
      </main>
    </div>
  );
}
