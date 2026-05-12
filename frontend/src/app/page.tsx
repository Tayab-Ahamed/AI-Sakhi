"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useUser } from "@/lib/user-context";

export default function Home() {
  const router = useRouter();
  const { user, isReady } = useUser();

  useEffect(() => {
    if (!isReady) return;
    router.replace(user ? "/chat" : "/onboard");
  }, [isReady, router, user]);

  return (
    <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-app)" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🌸</div>
        <p style={{ color: "var(--text-muted)", fontSize: 14 }}>Loading AI Sakhi...</p>
      </div>
    </div>
  );
}
