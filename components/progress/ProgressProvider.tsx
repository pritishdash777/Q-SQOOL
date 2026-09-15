"use client";

import { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { AUTH_CHANGED, getCachedUser, getCurrentUser, getStoredToken } from "@/lib/auth-api";
import { ProgressSession, type ProgressState, type SyncStatus } from "@/lib/progress-sync";
import type { UserProgress, ModuleProgress } from "@/lib/progress-types";

type ProgressContextValue = {
  progress: UserProgress | null;
  loading: boolean;
  syncStatus: SyncStatus;
  completeLesson: (moduleId: string, lessonId: string) => void;
  updateModule: (moduleId: string, patch: Partial<ModuleProgress>) => void;
  refreshProgress: () => void;
};
const ProgressContext = createContext<ProgressContextValue | undefined>(undefined);

function subscribeAuth(listener: () => void) {
  window.addEventListener(AUTH_CHANGED, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(AUTH_CHANGED, listener);
    window.removeEventListener("storage", listener);
  };
}

function AccountProgress({ children, token }: { children: ReactNode; token: string | null }) {
  const session = useRef<ProgressSession | null>(null);
  const [state, setState] = useState<Partial<ProgressState>>({ loading: true, syncStatus: "idle" });
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const stop = () => { controller.abort(); session.current?.stop(); };
    const initialize = async () => {
      try {
        const user = token ? getCachedUser() || await getCurrentUser({ token, signal: controller.signal }) : null;
        if (!active || getStoredToken() !== token) return;
        const current = new ProgressSession(user?.id || "guest", token, setState);
        session.current = current;
        setState(current.state);
        void current.refresh();
      } catch {
        if (active) setState({ loading: false, syncStatus: "offline" });
      }
    };
    void initialize();
    const retry = () => { if (session.current) void session.current.refresh(); else void initialize(); };
    // Invalidate work synchronously on logout, before React rerenders the keyed provider.
    const authChanged = () => { if (getStoredToken() !== token) stop(); };
    window.addEventListener(AUTH_CHANGED, authChanged);
    window.addEventListener("online", retry);
    window.addEventListener("focus", retry);
    return () => {
      active = false; stop();
      window.removeEventListener(AUTH_CHANGED, authChanged);
      window.removeEventListener("online", retry);
      window.removeEventListener("focus", retry);
    };
  }, [token]);

  const updateModule = (moduleId: string, patch: Partial<ModuleProgress>) => {
    if (getStoredToken() !== token) return;
    session.current?.update(moduleId, patch, window.location.pathname);
  };
  return <ProgressContext.Provider value={{
    progress: state.progress || null, loading: state.loading ?? true, syncStatus: state.syncStatus || "idle",
    updateModule,
    completeLesson: (moduleId, lessonId) => updateModule(moduleId, {
      completed: true, percent: 100, completedLessons: [lessonId],
    }),
    refreshProgress: () => { void session.current?.refresh(); },
  }}>{children}</ProgressContext.Provider>;
}

export function ProgressProvider({ children }: { children: ReactNode }) {
  const token = useSyncExternalStore(subscribeAuth, getStoredToken, () => null);
  return <AccountProgress key={token || "guest"} token={token}>{children}</AccountProgress>;
}

export function useProgress() {
  const context = useContext(ProgressContext);
  if (!context) throw new Error("useProgress must be used within a ProgressProvider");
  return context;
}
