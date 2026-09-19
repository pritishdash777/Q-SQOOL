import { getCurrentUser, getProgressSummary, saveProgress } from "./auth-api";
import { getLocalProgress, saveLocalProgress, mergeProgress, normalizeProgress, remoteProgress } from "./progress-storage";
import type { ModuleProgress, UserProgress } from "./progress-types";

export type SyncStatus = "idle" | "local" | "syncing" | "synced" | "offline" | "error";
export type ProgressState = { progress: UserProgress; loading: boolean; syncStatus: SyncStatus };
const defaults = { getCurrentUser, getProgressSummary, saveProgress, getLocalProgress, saveLocalProgress };

// One instance per authenticated session. Requests always carry its captured token.
export class ProgressSession {
  state: ProgressState;
  private controller = new AbortController();
  private timer?: ReturnType<typeof setTimeout>;
  private stopped = false;
  private busy = false;
  private verified = false;
  private revision = 0;

  constructor(readonly userId: string, private token: string | null,
    private publish: (state: ProgressState) => void, private api = defaults) {
    this.state = { progress: api.getLocalProgress(userId), loading: !!token, syncStatus: "local" };
  }

  private options() { return { token: this.token, signal: this.controller.signal }; }
  private emit(progress: UserProgress, syncStatus: SyncStatus, loading = false) {
    if (this.stopped) return;
    const cached = this.api.saveLocalProgress(this.userId, progress);
    this.state = { progress, syncStatus: !cached && syncStatus !== "synced" ? "error" : syncStatus, loading };
    this.publish(this.state);
  }

  async refresh() {
    if (this.stopped || this.busy || !this.token) return;
    this.busy = true;
    this.verified = false;
    this.emit(this.state.progress, "syncing", this.state.loading);
    try {
      const user = await this.api.getCurrentUser(this.options());
      if (this.stopped) return;
      if (user.id !== this.userId) throw new Error("Session account does not match cached account");
      const snapshot = await this.api.getProgressSummary(this.options());
      if (this.stopped) return;
      this.verified = true;
      const remote = remoteProgress(this.userId, snapshot.modules, snapshot.last_visited_path, snapshot.activity_days);
      const merged = mergeProgress(this.state.progress, remote);
      merged.pendingSync ||= Object.entries(merged.modules).some(([id, module]) => {
        const saved = remote.modules[id];
        return !saved || module.percent > saved.percent || (module.quizScore || 0) > (saved.quizScore || 0) ||
          module.completedLessons.some(lesson => !saved.completedLessons.includes(lesson));
      });
      this.emit(merged, merged.pendingSync ? "local" : "synced");
    } catch {
      this.emit(this.state.progress, "offline");
    } finally {
      this.busy = false;
    }
    if (this.verified && this.state.progress.pendingSync) await this.flush();
  }

  update(moduleId: string, patch: Partial<ModuleProgress>, path?: string) {
    if (this.stopped) return;
    const current = this.state.progress;
    const now = new Date().toISOString();
    const currentModule = current.modules[moduleId];
    const updated = normalizeProgress({ ...current, pendingSync: true, updatedAt: now,
      lastVisitedPath: path || current.lastVisitedPath,
      modules: { ...current.modules, [moduleId]: {
        ...(currentModule || { moduleId, completed: false, percent: 0, completedLessons: [] }), ...patch, updatedAt: now,
      } },
    });
    this.revision++;
    const merged = mergeProgress(updated, current);
    const previous = current.modules[moduleId];
    const next = merged.modules[moduleId];
    const changed = next && (!previous || next.percent > previous.percent || (next.quizScore || 0) > (previous.quizScore || 0) || next.completedLessons.some(id => !previous.completedLessons.includes(id)));
    if (this.userId === "guest" && changed) merged.activityDays = [...new Set([...(current.activityDays || []), now.slice(0, 10)])].sort();
    this.emit(merged, "local");
    clearTimeout(this.timer);
    if (this.token) this.timer = setTimeout(() => void (this.verified ? this.flush() : this.refresh()), 500);
  }

  async flush() {
    if (this.stopped || this.busy || !this.token || !this.verified || !this.state.progress.pendingSync) return;
    this.busy = true;
    const sent = this.state.progress;
    const revision = this.revision;
    this.emit(sent, "syncing");
    let saved = false;
    try {
      const remote = await this.api.saveProgress(sent, this.options());
      if (this.stopped) return;
      const merged = mergeProgress(this.state.progress, remoteProgress(this.userId, remote.modules, remote.last_visited_path, remote.activity_days));
      merged.pendingSync = revision !== this.revision;
      this.emit(merged, merged.pendingSync ? "local" : "synced");
      saved = true;
    } catch {
      this.emit(this.state.progress, "offline");
    } finally {
      this.busy = false;
    }
    // Acknowledging one save must not clear changes made while it was in flight.
    if (saved && this.state.progress.pendingSync) await this.flush();
  }

  stop() {
    this.stopped = true;
    clearTimeout(this.timer);
    this.controller.abort();
  }
}
