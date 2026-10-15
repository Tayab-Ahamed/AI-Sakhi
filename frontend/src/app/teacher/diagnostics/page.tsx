"use client";

import Sidebar from "@/components/Sidebar";
import Link from "next/link";
import { DiagnosticEditor } from "@/components/diagnostics/DiagnosticEditor";
import { useRequireAuth } from "@/lib/auth";
import { useDiagnosticSessionCurrent } from "@/lib/diagnostic-session";
import type { SakhiRole } from "@/lib/user";

const roles: SakhiRole[] = ["teacher", "admin"];
export default function DiagnosticEditorPage() {
  const { user, auth, isReady } = useRequireAuth(roles);
  const identity = isReady && auth && user && roles.includes(user.role) && user.organization_id ? { user_id: user.user_id, organization_id: user.organization_id, class_: user.class_ } : undefined;
  const current = useDiagnosticSessionCurrent(auth?.expires_at, identity);
  if (!isReady || !user || !auth || !roles.includes(user.role)) return <p role="status" className="p-6">Restoring your staff session…</p>;
  if (!current) return <p role="status" className="p-6">Session expired or restoring. <Link href="/login">Sign in again</Link></p>;
  if (!user.organization_id) return <p role="status" className="p-6">School account required. Ask your school administrator to connect your account.</p>;
  return <div className="app-shell"><Sidebar /><main className="main-content diagnostic-main">
    <div className="diagnostic-page"><h1>Diagnostic editor</h1><p className="diagnostic-lead">Curate a small assessment from your school&apos;s approved question bank.</p>
      <DiagnosticEditor identity={{ user_id: user.user_id, organization_id: user.organization_id, class_: user.class_ }} />
    </div>
  </main></div>;
}
