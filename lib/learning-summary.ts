import { learningTrack } from "./learning-tracks";
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
  const track = learningTrack(role);
  const foundationFirst = assessmentScore !== undefined && assessmentScore < 2;
  const ordered = foundationFirst
    ? ["qubits", ...track.order.filter(id => learningModules.find(module => module.id === id)?.category === "Foundation"), ...track.order]
    : track.order;
  const order = [...new Set(ordered)];
  // Prerequisites are visible guidance, not a filter that makes every role identical.
  return learningModules.filter(module => !modules[module.id]?.completed)
    .sort((a, b) => {
      const rank = (id: string) => order.indexOf(id) - ((modules[id]?.percent || 0) > 0 ? 20 : 0);
      return rank(a.id) - rank(b.id);
    }).slice(0, 3);
}
