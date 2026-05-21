"use client";

import { ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { usePathname } from "next/navigation";

import { AccessibilityProvider } from "@/lib/accessibility-context";
import { UserProvider } from "@/lib/user-context";
import PwaManager from "@/components/PwaManager";
import { ToastProvider } from "@/components/ToastProvider";

function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={pathname}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.25, ease: "easeInOut" }}
        style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", flex: 1 }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

export default function AppProviders({ children }: { children: ReactNode }) {
  return (
    <UserProvider>
      <AccessibilityProvider>
        <ToastProvider>
          <PageTransition>
            {children}
          </PageTransition>
          <PwaManager />
        </ToastProvider>
      </AccessibilityProvider>
    </UserProvider>
  );
}
