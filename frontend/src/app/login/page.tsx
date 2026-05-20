"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/lib/user-context";
import { api } from "@/lib/api";
import { Eye, EyeOff, ArrowRight } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const { setUser } = useUser();
  const [form, setForm] = useState({ name: "", password: "" });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.password) return;
    setLoading(true);
    setError("");
    try {
      const res = await (api as any).login(form) as any;
      setUser(res, res.auth || null);
      router.push("/chat");
    } catch (err: any) {
      setError(err?.message || "Invalid name or password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-app)", display: "flex", alignItems: "center", justifyContent: "center", padding: "32px 16px" }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <span style={{ fontSize: 36 }}>🌸</span>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginTop: 8 }}>Welcome back</h1>
          <p style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 4 }}>Sign in to continue learning</p>
        </div>

        <div className="card" style={{ padding: 28 }}>
          {error && (
            <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "var(--radius-md)", padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#dc2626" }}>
              {error}
            </div>
          )}

          <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>Your Name</label>
              <input
                className="input"
                placeholder="Enter your name"
                value={form.name}
                onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                autoFocus
              />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>Password</label>
              <div style={{ position: "relative" }}>
                <input
                  className="input"
                  type={showPw ? "text" : "password"}
                  placeholder="Enter your password"
                  value={form.password}
                  onChange={(e) => setForm(f => ({ ...f, password: e.target.value }))}
                  style={{ paddingRight: 42 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(s => !s)}
                  style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <button
              className="btn btn-primary"
              type="submit"
              disabled={loading || !form.name.trim() || !form.password}
              style={{ width: "100%", marginTop: 4, opacity: (loading || !form.name.trim() || !form.password) ? 0.6 : 1 }}
            >
              {loading ? "Signing in…" : <><span>Sign In</span> <ArrowRight size={15} /></>}
            </button>
          </form>

          <p style={{ textAlign: "center", fontSize: 13, color: "var(--text-secondary)", marginTop: 20 }}>
            New here?{" "}
            <button onClick={() => router.push("/onboard")} style={{ background: "none", border: "none", color: "var(--emerald)", fontWeight: 600, cursor: "pointer", fontSize: 13 }}>Create account →</button>
          </p>
        </div>
      </div>
    </div>
  );
}
