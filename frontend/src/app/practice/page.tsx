"use client";

import Sidebar from "@/components/Sidebar";
import ReviewedPractice from "@/components/ReviewedPractice";
import { useRequireAuth } from "@/lib/auth";
import type { SakhiRole } from "@/lib/user";

const roles: SakhiRole[] = ["student"];

export default function PracticePage() {
  const { user, auth, isReady } = useRequireAuth(roles);
  if (!isReady || !user || !auth || user.role !== "student") return <p role="status" className="p-6">Restoring your student session…</p>;
  return <div className="app-shell">
    <Sidebar />
    <main className="main-content practice-main">
      <div className="practice-page">
        <h1>School practice</h1>
        <p>Practise with reviewed questions and check your understanding.</p>
        <ReviewedPractice userId={user.user_id} />
      </div>
    </main>
  </div>;
}
