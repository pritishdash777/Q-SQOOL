import { getCurrentUser, getProfile, getProgress, saveProgress } from "./auth-api";
import { getLocalProgress, saveLocalProgress, mergeProgress, normalizeProgress, remoteProgress } from "./progress-storage";
import type { ModuleProgress, UserProgress } from "./progress-types";

export type SyncStatus = "idle" | "local" | "syncing" | "synced" | "offline" | "error";
export type ProgressState = { progress: UserProgress; loading: boolean; syncStatus: SyncStatus };
const defaults = { getCurrentUser, getProfile, getProgress, saveProgress, getLocalProgress, saveLocalProgress };

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
    try {
      const user = await this.api.getCurrentUser(this.options());
      if (this.stopped) return;
      if (user.id !== this.userId) throw new Error("Session account does not match cached account");
      this.verified = true;
      const [records, profile] = await Promise.all([
        this.api.getProgress(this.options()), this.api.getProfile(this.options()),
      ]);
      if (this.stopped) return;
      const merged = mergeProgress(this.state.progress, remoteProgress(this.userId, records, profile.last_visited_path));
      const remote = remoteProgress(this.userId, records, profile.last_visited_path);
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
    const module = current.modules[moduleId];
    const updated = normalizeProgress({ ...current, pendingSync: true, updatedAt: now,
      lastVisitedPath: path || current.lastVisitedPath,
      modules: { ...current.modules, [moduleId]: {
        ...(module || { moduleId, completed: false, percent: 0, completedLessons: [] }), ...patch, updatedAt: now,
      } },
    });
    this.revision++;
    this.emit(mergeProgress(updated, current), "local");
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
      const merged = mergeProgress(this.state.progress, remoteProgress(this.userId, remote.modules));
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
