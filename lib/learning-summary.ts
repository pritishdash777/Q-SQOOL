import { learningModules } from "./curriculum";
import { normalizeProgress } from "./progress-storage";
import type { UserProgress } from "./progress-types";

export function learningSummary(progress: UserProgress | null, now = new Date()) {
  const clean = progress ? normalizeProgress(progress) : null;
  const day = new Date(`${now.toISOString().slice(0, 10)}T00:00:00Z`);
  const days = new Set((progress?.activityDays || []).filter(value => /^\d{4}-\d{2}-\d{2}$/.test(value)));
  const recentDays = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(day.getTime() - (6 - i) * 86400000).toISOString().slice(0, 10);
    return { date, active: days.has(date) };
  });
  if (!days.has(day.toISOString().slice(0, 10))) day.setUTCDate(day.getUTCDate() - 1);
  let streak = 0;
  while (days.has(day.toISOString().slice(0, 10))) { streak++; day.setUTCDate(day.getUTCDate() - 1); }
  const completed = clean?.completedModules || 0;
  return { xp: clean?.xp || 0, completed, total: learningModules.length, mastery: Math.round(completed / learningModules.length * 100), streak, recentDays };
}

export function recommendedModules(progress: UserProgress | null, role = "Student", assessmentScore?: number) {
  const modules = progress?.modules || {};
  return learningModules.filter(module => !modules[module.id]?.completed && module.prereqs.every(id => (modules[id]?.percent || 0) >= 60))
    .sort((a, b) => {
      const score = (module: typeof a) => (modules[module.id]?.percent || 0) +
        (assessmentScore !== undefined && assessmentScore < 2 && module.category === "Foundation" ? 200 :
          role === "Researcher" && module.category === "Algorithm" ? 100 : role === "Professional" && ["circuits", "vqe-qaoa"].includes(module.id) ? 100 : 0);
      return score(b) - score(a);
    }).slice(0, 3);
}
