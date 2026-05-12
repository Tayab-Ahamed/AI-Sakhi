"use client";

import { ReactNode } from "react";

import { AccessibilityProvider } from "@/lib/accessibility-context";
import { UserProvider } from "@/lib/user-context";
import PwaManager from "@/components/PwaManager";

export default function AppProviders({ children }: { children: ReactNode }) {
  return (
    <UserProvider>
      <AccessibilityProvider>
        {children}
        <PwaManager />
      </AccessibilityProvider>
    </UserProvider>
  );
}
