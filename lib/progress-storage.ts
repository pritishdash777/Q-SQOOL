import { UserProgress, ModuleProgress } from "./progress-types";

function getStorageKey(userId: string): string {
  return `q-sqool-progress:v1:${userId}`;
}

export function createEmptyProgress(userId: string): UserProgress {
  return {
    version: 1,
    userId,
    xp: 0,
    completedModules: 0,
    modules: {},
    updatedAt: new Date().toISOString(),
    pendingSync: false,
  };
}

export function getLocalProgress(userId: string): UserProgress {
  if (typeof window === "undefined") return createEmptyProgress(userId);

  try {
    const data = localStorage.getItem(getStorageKey(userId));
    if (!data) return createEmptyProgress(userId);
    
    const parsed = JSON.parse(data);
    
    // basic validation
    if (parsed && parsed.version === 1 && parsed.userId === userId) {
      return parsed as UserProgress;
    }
    
    return createEmptyProgress(userId);
  } catch (error) {
    console.error("Failed to parse local progress", error);
    return createEmptyProgress(userId);
  }
}

export function saveLocalProgress(userId: string, progress: UserProgress): void {
  if (typeof window === "undefined") return;
  
  try {
    const clampedProgress = { ...progress };
    
    // Ensure all percents are 0-100
    if (clampedProgress.modules) {
      Object.keys(clampedProgress.modules).forEach(moduleId => {
        const mod = clampedProgress.modules[moduleId];
        if (mod) {
          mod.percent = Math.min(100, Math.max(0, mod.percent || 0));
        }
      });
    }
    
    localStorage.setItem(getStorageKey(userId), JSON.stringify(clampedProgress));
  } catch (error) {
    console.error("Failed to save local progress", error);
  }
}

export function updateLocalModuleProgress(
  userId: string, 
  moduleId: string, 
  patch: Partial<ModuleProgress>
): UserProgress {
  const current = getLocalProgress(userId);
  
  const currentModule = current.modules[moduleId] || {
    moduleId,
    completed: false,
    percent: 0,
    completedLessons: [],
    updatedAt: new Date().toISOString(),
  };

  const newModule = { ...currentModule, ...patch };
  
  // Clamp percent
  newModule.percent = Math.min(100, Math.max(0, newModule.percent || 0));
  
  if (newModule.percent === 100) {
    newModule.completed = true;
  }
  
  newModule.updatedAt = new Date().toISOString();

  current.modules[moduleId] = newModule;
  current.updatedAt = new Date().toISOString();
  current.pendingSync = true;
  
  // Re-calculate completed modules safely based on modules object, avoiding duplicates
  const completedIds = Object.values(current.modules).filter(m => m.completed).map(m => m.moduleId);
  current.completedModules = completedIds.length;
  
  saveLocalProgress(userId, current);
  return current;
}

export function markProgressSynced(userId: string): void {
  const current = getLocalProgress(userId);
  current.pendingSync = false;
  saveLocalProgress(userId, current);
}

// Do not expose a generic clear local progress function to avoid accidental logout-driven deletions.
// We explicitly want to preserve local progress when the user logs out.
