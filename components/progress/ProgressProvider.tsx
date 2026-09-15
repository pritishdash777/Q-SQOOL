"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { getCurrentUser, getProgress, saveProgress, updateModuleProgress, hasAuthToken } from "@/lib/auth-api";
import { getLocalProgress, saveLocalProgress, updateLocalModuleProgress, markProgressSynced } from "@/lib/progress-storage";
import { UserProgress, ModuleProgress } from "@/lib/progress-types";

type SyncStatus = "idle" | "saving-local" | "syncing" | "synced" | "offline" | "error";

type ProgressContextValue = {
  progress: UserProgress | null;
  loading: boolean;
  syncStatus: SyncStatus;
  completeLesson: (moduleId: string, lessonId: string) => void;
  updateModule: (moduleId: string, patch: Partial<ModuleProgress>) => void;
  addXP: (amount: number) => void;
  refreshProgress: () => void;
};

const ProgressContext = createContext<ProgressContextValue | undefined>(undefined);

export const ProgressProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");

  // Helper to merge local and remote records
  const mergeProgress = useCallback((local: UserProgress, remote: UserProgress): UserProgress => {
    // Choose newer based on updatedAt
    if (new Date(local.updatedAt) > new Date(remote.updatedAt)) {
      return { ...local, pendingSync: true };
    }
    // remote is newer
    return { ...remote, pendingSync: false };
  }, []);

  const loadAndSync = useCallback(async () => {
      // If no auth token, treat as unauthenticated visitor
      if (!hasAuthToken()) {
        setLoading(false);
        setSyncStatus("idle");
        setProgress(null);
        return;
      }
      try {
        setLoading(true);
        const user = await getCurrentUser();
        const userId = user.id;

        // Load local progress (or create empty)
        const localProg = getLocalProgress(userId);

        // Fetch backend progress
        const remoteArray = await getProgress();
        // Convert array of LearningProgress into UserProgress shape
        const remoteProg: UserProgress = {
          version: 1,
          userId,
          xp: 0,
          completedModules: 0,
          modules: {},
          updatedAt: new Date().toISOString(),
          pendingSync: false,
        };
        remoteArray.forEach(p => {
          remoteProg.modules[p.module_id] = {
            moduleId: p.module_id,
            completed: p.completed,
            percent: p.progress,
            completedLessons: [],
            updatedAt: p.updated_at,
          };
          if (p.completed) remoteProg.completedModules += 1;
        });

        const merged = mergeProgress(localProg, remoteProg);
        setProgress(merged);
        saveLocalProgress(userId, merged);

        if (merged.pendingSync) {
          setSyncStatus("syncing");
          await saveProgress(merged);
          markProgressSynced(userId);
          setSyncStatus("synced");
          setProgress({ ...merged, pendingSync: false });
        } else {
          setSyncStatus("synced");
        }
      } catch (err) {
        // Handle unauthenticated errors silently
        if (err && typeof err === "object" && "status" in err && err.status === 401) {
          // token likely invalid; clear state
          setLoading(false);
          setSyncStatus("idle");
          setProgress(null);
        } else {
          console.error(err);
          setSyncStatus("error");
        }
      } finally {
        // Ensure loading is false for authenticated paths; unauthenticated already returned early
        setLoading(false);
      }
    }, [mergeProgress]);

  // Initial load
  useEffect(() => {
    loadAndSync();
  }, [loadAndSync]);

  // Retry on focus / online
  useEffect(() => {
    const handler = () => {
      if (progress && progress.pendingSync) {
        loadAndSync();
      }
    };
    window.addEventListener("focus", handler);
    window.addEventListener("online", handler);
    return () => {
      window.removeEventListener("focus", handler);
      window.removeEventListener("online", handler);
    };
  }, [progress, loadAndSync]);

  const completeLesson = (moduleId: string, lessonId: string) => {
    if (!progress) return;
    const userId = progress.userId;
    const updated = updateLocalModuleProgress(userId, moduleId, {
      completed: true,
      percent: 100,
      completedLessons: [lessonId],
    });
    setProgress(updated);
    // debounce sync
    setSyncStatus("saving-local");
    saveLocalProgress(userId, updated);
    // fire async sync
    (async () => {
      setSyncStatus("syncing");
      await saveProgress(updated);
      markProgressSynced(userId);
      setSyncStatus("synced");
    })();
  };

  const updateModule = (moduleId: string, patch: Partial<ModuleProgress>) => {
    if (!progress) return;
    const userId = progress.userId;
    const updated = updateLocalModuleProgress(userId, moduleId, patch);
    setProgress(updated);
    setSyncStatus("saving-local");
    saveLocalProgress(userId, updated);
    (async () => {
      setSyncStatus("syncing");
      await updateModuleProgress(moduleId, patch);
      markProgressSynced(userId);
      setSyncStatus("synced");
    })();
  };

  const addXP = (amount: number) => {
    if (!progress) return;
    const userId = progress.userId;
    const updated = { ...progress, xp: progress.xp + amount, updatedAt: new Date().toISOString(), pendingSync: true };
    setProgress(updated);
    saveLocalProgress(userId, updated);
    (async () => {
      setSyncStatus("syncing");
      await saveProgress(updated);
      markProgressSynced(userId);
      setSyncStatus("synced");
    })();
  };

  const refreshProgress = () => {
    loadAndSync();
  };

  return (
    <ProgressContext.Provider
      value={{
        progress,
        loading,
        syncStatus,
        completeLesson,
        updateModule,
        addXP,
        refreshProgress,
      }}
    >
      {children}
    </ProgressContext.Provider>
  );
};

export const useProgress = () => {
  const ctx = useContext(ProgressContext);
  if (!ctx) {
    throw new Error("useProgress must be used within a ProgressProvider");
  }
  return ctx;
};
