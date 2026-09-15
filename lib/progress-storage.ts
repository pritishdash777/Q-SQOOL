import type { UserProgress, ModuleProgress } from "./progress-types";
import type { LearningProgress } from "./auth-types";
import rewards from "./learning-catalog.json";

export function createEmptyProgress(userId: string): UserProgress {
  return { version: 1, userId, xp: 0, completedModules: 0, modules: {}, updatedAt: "", pendingSync: false };
}

export function lessonPath(path?: string | null): string {
  const match = path?.match(/^\/(learn|algorithms)\/([a-z-]+)$/);
  return match && Object.hasOwn(rewards, match[2]) ? path! : "/learn";
}

export function normalizeProgress(value: UserProgress): UserProgress {
  const modules: Record<string, ModuleProgress> = {};
  for (const [id, module] of Object.entries(value.modules || {})) {
    if (!Object.hasOwn(rewards, id) || !module) continue;
    const validIds = new Set([id, ...[1, 2, 3].map(i => `${id}:step-${i}`)]);
    const lessons = [...new Set((Array.isArray(module.completedLessons) ? module.completedLessons : [])
      .filter(lesson => validIds.has(lesson)))];
    const completed = module.completed === true || module.percent === 100 || lessons.includes(id);
    if (completed && !lessons.includes(id)) lessons.push(id);
    modules[id] = { ...module, moduleId: id, completed, completedLessons: lessons.sort(),
      percent: completed ? 100 : Math.round(Math.min(99, Math.max(0, Number(module.percent) || 0))),
      updatedAt: module.updatedAt || "" };
  }
  const completed = Object.values(modules).filter(module => module.completed);
  return { ...value, modules, completedModules: completed.length,
    xp: completed.reduce((sum, module) => sum + rewards[module.moduleId as keyof typeof rewards], 0) };
}

export function mergeProgress(local: UserProgress, remote: UserProgress): UserProgress {
  if (local.userId !== remote.userId) throw new Error("Cannot merge progress across accounts");
  const modules = { ...remote.modules };
  for (const [id, module] of Object.entries(local.modules)) {
    const other = modules[id];
    modules[id] = other ? { ...other, ...module,
      completed: module.completed || other.completed,
      percent: Math.max(module.percent, other.percent),
      quizScore: Math.max(module.quizScore ?? 0, other.quizScore ?? 0),
      completedLessons: [...new Set([...module.completedLessons, ...other.completedLessons])],
      updatedAt: module.updatedAt > other.updatedAt ? module.updatedAt : other.updatedAt,
    } : module;
  }
  return normalizeProgress({ ...remote, ...local, modules,
    lastVisitedPath: local.lastVisitedPath || remote.lastVisitedPath });
}

export function remoteProgress(userId: string, records: LearningProgress[], path?: string | null): UserProgress {
  return normalizeProgress({ ...createEmptyProgress(userId), lastVisitedPath: path || undefined,
    modules: Object.fromEntries(records.map(record => [record.module_id, {
      moduleId: record.module_id, completed: record.completed, percent: record.progress,
      quizScore: record.quiz_score, completedLessons: record.completed_lessons || [], updatedAt: record.updated_at,
    }])) });
}

export function getLocalProgress(userId: string): UserProgress {
  if (typeof window === "undefined") return createEmptyProgress(userId);
  try {
    const parsed = JSON.parse(localStorage.getItem(`q-sqool-progress:v1:${userId}`) || "null");
    if (parsed?.version === 1 && parsed.userId === userId) return normalizeProgress(parsed);
    // The legacy shared cache has no account owner. Preserve it as guest data only.
    if (userId === "guest") {
      const legacy = JSON.parse(localStorage.getItem("q-sqool-learning") || "{}");
      return remoteProgress(userId, Object.entries(legacy.progress || {}).map(([id, percent]) => ({
        module_id: id, progress: Number(percent), completed: percent === 100,
        quiz_score: null, completed_lessons: [], updated_at: "",
      })));
    }
  } catch { /* Corrupt or unavailable cache: start in memory. */ }
  return createEmptyProgress(userId);
}

export function saveLocalProgress(userId: string, progress: UserProgress): boolean {
  if (typeof window === "undefined" || progress.userId !== userId) return false;
  try {
    localStorage.setItem(`q-sqool-progress:v1:${userId}`, JSON.stringify(progress));
    return true;
  } catch { return false; }
}
