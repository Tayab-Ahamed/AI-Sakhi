"use client";

import { createContext, useContext, useEffect, useState } from "react";

import { api } from "@/lib/api";
import { getSessionId, getStoredAuth, getStoredUser, SakhiAuth, SakhiUser, saveStoredAuth, saveStoredUser } from "@/lib/user";

type UserContextValue = {
  user: SakhiUser | null;
  auth: SakhiAuth | null;
  sessionId: string;
  isReady: boolean;
  setUser: (user: SakhiUser | null, auth?: SakhiAuth | null) => void;
  refreshUser: () => Promise<void>;
  updateProfile: (patch: Partial<SakhiUser>) => Promise<SakhiUser | null>;
  clearUser: () => void;
};

const UserContext = createContext<UserContextValue | null>(null);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<SakhiUser | null>(() => getStoredUser());
  const [auth, setAuthState] = useState<SakhiAuth | null>(() => getStoredAuth());
  const [sessionId] = useState(() => getSessionId());
  const isReady = typeof window !== "undefined";

  useEffect(() => {
    if (!auth?.token) return;
    api.verifyToken({ token: auth.token }).catch(() => {
      setAuthState(null);
      saveStoredAuth(null);
    });
  }, [auth?.token]);

  useEffect(() => {
    if (!user?.user_id) return;
    api.getUser(user.user_id)
      .then((fresh) => {
        setUserState(fresh);
        saveStoredUser(fresh);
      })
      .catch(() => {});
  }, [user?.user_id]);

  const setUser = (nextUser: SakhiUser | null, nextAuth?: SakhiAuth | null) => {
    setUserState(nextUser);
    if (nextUser) {
      saveStoredUser(nextUser);
    } else if (typeof window !== "undefined") {
      localStorage.removeItem("sakhi_user");
    }
    if (nextAuth !== undefined) {
      setAuthState(nextAuth);
      saveStoredAuth(nextAuth);
    }
  };

  const refreshUser = async () => {
    if (!user?.user_id) return;
    const fresh = await api.getUser(user.user_id);
    setUser(fresh, auth);
  };

  const updateProfile = async (patch: Partial<SakhiUser>) => {
    if (!user?.user_id) return null;
    const next = { ...user, ...patch };
    setUser(next, auth);
    try {
      const saved = await api.updateUser(user.user_id, {
        name: next.name,
        class_: next.class_,
        language: next.language,
        weak_subject: next.weak_subject,
        role: next.role,
        organization_id: next.organization_id,
      });
      setUser(saved, auth);
      return saved;
    } catch (error) {
      setUser(user, auth);
      throw error;
    }
  };

  const clearUser = () => {
    setUser(null, null);
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("sakhi_session");
    }
  };

  const value: UserContextValue = {
    user,
    auth,
    sessionId,
    isReady,
    setUser,
    refreshUser,
    updateProfile,
    clearUser,
  };

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) {
    throw new Error("useUser must be used within UserProvider");
  }
  return ctx;
}
