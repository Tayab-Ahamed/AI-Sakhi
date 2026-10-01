"use client";

/**
 * JWT / Auth helpers for the AI Sakhi frontend.
 * The backend now issues real JWT tokens. This module:
 * 1. Decodes the token payload (WITHOUT signature verification — trust the backend for that)
 * 2. Provides a `useRequireAuth` hook that redirects if the user is unauthenticated or lacks the required role
 * 3. Provides helpers to check token expiry locally so we don't hammer the backend
 * 4. Provides role routing helpers for role-based landing pages
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/lib/user-context";
import { SakhiRole } from "@/lib/user";

/** Returns the correct home page for each role after login. */
export function getRoleLandingPage(role: string | undefined): string {
  switch (role) {
    case "teacher": return "/teacher";
    case "parent":  return "/parent";
    case "admin":   return "/admin";
    default:        return "/chat"; // student
  }
}

/** Per-role accent colour, emoji, and label used across the UI. */
export const ROLE_CONFIG: Record<string, { label: string; emoji: string; color: string; bg: string; tagline: string }> = {
  student: {
    label: "Student",
    emoji: "🎓",
    color: "#5e6ad2",
    bg: "linear-gradient(135deg, #18192c 0%, #292d52 100%)",
    tagline: "Continue your learning journey",
  },
  teacher: {
    label: "Teacher",
    emoji: "📚",
    color: "#8b5cf6",
    bg: "linear-gradient(135deg, #1c152e 0%, #352554 100%)",
    tagline: "Manage your classroom",
  },
  parent: {
    label: "Parent",
    emoji: "👨‍👩‍👧",
    color: "#f59e0b",
    bg: "linear-gradient(135deg, #2b1d0e 0%, #4a341a 100%)",
    tagline: "Monitor your child's progress",
  },
  admin: {
    label: "Admin",
    emoji: "🛡️",
    color: "#f43f5e",
    bg: "linear-gradient(135deg, #2b1118 0%, #4a1d28 100%)",
    tagline: "Manage the platform",
  },
};

/** Decode the JWT payload (base64url → JSON). Does NOT verify the signature. */
export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    // base64url → base64 → decode
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(base64);
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Check if a JWT token is expired based on its `exp` claim. */
export function isTokenExpired(token: string): boolean {
  const payload = decodeJwtPayload(token);
  if (!payload) return true;
  const exp = payload.exp as number | undefined;
  if (!exp) return false; // no expiry claim — treat as valid
  return Date.now() / 1000 > exp;
}

/** Extract the role from a token. */
export function getTokenRole(token: string): SakhiRole | null {
  const payload = decodeJwtPayload(token);
  if (!payload) return null;
  return (payload.role as SakhiRole) || null;
}

/**
 * Hook: redirect to /onboard if unauthenticated.
 * Optionally restrict to specific roles — redirects to /chat if authenticated but wrong role.
 *
 * @example
 *   useRequireAuth();                         // any authenticated user
 *   useRequireAuth(["admin"]);                // admin only
 *   useRequireAuth(["teacher", "admin"]);     // teacher or admin
 */
export function useRequireAuth(allowedRoles?: SakhiRole[]) {
  const router = useRouter();
  const { user, auth, isReady } = useUser();

  useEffect(() => {
    if (!isReady) return;

    // Not logged in at all
    if (!user || !auth?.token) {
      router.replace("/onboard");
      return;
    }

    // Token expired
    if (isTokenExpired(auth.token)) {
      router.replace("/onboard");
      return;
    }

    // Role check
    if (allowedRoles && allowedRoles.length > 0) {
      const role = user.role as SakhiRole;
      if (!allowedRoles.includes(role)) {
        // Authenticated but wrong role — go to their own dashboard
        router.replace("/chat");
        return;
      }
    }
  }, [isReady, user, auth, router, allowedRoles]);

  return { user, auth, isReady };
}
