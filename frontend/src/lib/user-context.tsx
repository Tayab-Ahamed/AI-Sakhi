"use client";

import { createContext, useContext, useEffect, useState } from "react";

import { api, ApiError } from "@/lib/api";
import { getSessionId, getStoredAuth, getStoredUser, SakhiAuth, SakhiUser, saveStoredAuth, saveStoredUser } from "@/lib/user";
import { clearDeviceData } from "@/lib/device-data";

type UserContextValue = {
  user: SakhiUser | null;
  auth: SakhiAuth | null;
  sessionId: string;
  isReady: boolean;
  setUser: (user: SakhiUser | null, auth?: SakhiAuth | null) => void;
  refreshUser: () => Promise<void>;
  updateProfile: (patch: Partial<SakhiUser>) => Promise<SakhiUser | null>;
  clearUser: () => Promise<void>;
};

const UserContext = createContext<UserContextValue | null>(null);

export function UserProvider({ children }: { children: React.ReactNode }) {
  // Keep server and first client render identical. Browser storage is loaded
  // after mount so authenticated shells do not cause hydration mismatches.
  const [user, setUserState] = useState<SakhiUser | null>(null);
  const [auth, setAuthState] = useState<SakhiAuth | null>(null);
  const [sessionId] = useState(() => getSessionId());
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let ignore = false;
    async function restore() {
      getStoredAuth(); // erase credentials left by older versions
      try {
        if (localStorage.getItem("sakhi_logout_pending")) {
          try {
            await api.logout({ token: "" });
          } catch (error) {
            if (!(error instanceof ApiError && error.status === 401)) throw error;
          }
          localStorage.removeItem("sakhi_logout_pending");
          return;
        }
        const current = await api.getSession() as unknown as { user: SakhiUser; auth: SakhiAuth };
        if (!ignore) {
          setUserState(current.user);
          setAuthState(current.auth);
          saveStoredUser(current.user);
          saveStoredAuth(current.auth);
        }
      } catch (error) {
        if (error instanceof ApiError && [401, 403].includes(error.status)) {
          const cachedUser = getStoredUser();
          try { await clearDeviceData(cachedUser?.user_id); }
          catch {
            saveStoredAuth(null);
            localStorage.setItem("sakhi_logout_pending", "true");
          }
        }
        if (!ignore && !navigator.onLine && !localStorage.getItem("sakhi_logout_pending")) {
          const cached = getStoredAuth();
          if (cached && new Date(cached.expires_at).getTime() > Date.now()) {
            setUserState(getStoredUser());
            setAuthState(cached);
          }
        }
      } finally {
        if (!ignore) setIsReady(true);
      }
    }
    void restore();
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    if (!user?.user_id) return;
    let ignore = false;
    (api.getUser(user.user_id) as Promise<unknown> as Promise<SakhiUser>)
      .then((fresh) => {
        if (!ignore && fresh) {
          setUserState(fresh);
          saveStoredUser(fresh);
        }
      })
      .catch(() => {});
    return () => {
      ignore = true;
    };
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
    const fresh = await api.getUser(user.user_id) as unknown as SakhiUser;
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
      }) as unknown as SakhiUser;
      setUser(saved, auth);
      return saved;
    } catch (error) {
      setUser(user, auth);
      throw error;
    }
  };

  const clearUser = async () => {
    localStorage.setItem("sakhi_logout_pending", "true");
    try {
      await api.logout({ token: "" });
      localStorage.removeItem("sakhi_logout_pending");
    } catch {
      // The next online mount must revoke the cookie before restoring a session.
    }
    setUser(null, null);
    await clearDeviceData(user?.user_id);
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
