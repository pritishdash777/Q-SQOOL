export type ModuleProgress = {
  moduleId: string;
  completed: boolean;
  percent: number; // 0-100
  quizScore?: number | null;
  completedLessons: string[];
  updatedAt: string;
};

export type UserProgress = {
  version: 1;
  userId: string;
  xp: number;
  completedModules: number;
  modules: Record<string, ModuleProgress>;
  lastVisitedPath?: string;
  updatedAt: string;
  pendingSync: boolean;
};
