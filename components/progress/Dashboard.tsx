"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, BookOpen, Bot, Flame, FolderOpen, Plus, Sparkles, Wand2, Zap } from "lucide-react";
import { useProgress } from "./ProgressProvider";
import SyncStatus from "./SyncStatus";
import { Progress } from "@/components/ui/progress";
import { getProjects, getStoredToken } from "@/lib/auth-api";
import { readLocalProjects } from "@/lib/project-storage";
import { learningModules } from "@/lib/curriculum";
import { learningSummary, recommendedModules } from "@/lib/learning-summary";
import { lessonPath } from "@/lib/progress-storage";
import type { Circuit, Page } from "@/lib/quantum-types";

export function Dashboard({ navigate, setCircuit }: { navigate: (page: Page) => void; setCircuit: (circuit: Circuit) => void }) {
  const router = useRouter();
  const { progress, loading, refreshProgress } = useProgress();
  const metrics = learningSummary(progress);
  const [preferences, setPreferences] = useState<{ role: string; score?: number }>({ role: "Student" });
  const suggestions = recommendedModules(progress, preferences.role, preferences.score);
  const savedPath = lessonPath(progress?.lastVisitedPath);
  const resume = learningModules.find(module => savedPath.endsWith(`/${module.id}`));
  const [projects, setProjects] = useState<{ id: string; name: string; updatedAt: string; circuit: Circuit; source: string }[]>([]);
  const [projectError, setProjectError] = useState("");
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const userId = progress?.userId;
  useEffect(() => {
    if (!userId) return;
    const controller = new AbortController();
    const token = getStoredToken();
    const load = async () => {
      setProjectsLoading(true); setProjectError(""); setProjects([]);
      try {
        setPreferences({ role: localStorage.getItem(`q-sqool-learning-role:${userId}`) || "Student", score: JSON.parse(localStorage.getItem(`q-sqool-assessment:${userId}`) || "null")?.score });
        const local = readLocalProjects(localStorage, userId).map(project => ({ ...project, id: String(project.id), source: "On this device" }));
        setProjects(local);
        if (userId !== "guest") {
          const cloud = await getProjects({ token, signal: controller.signal });
          if (controller.signal.aborted || token !== getStoredToken()) return;
          setProjects([...local, ...cloud.map(project => ({ id: project.id, name: project.name, updatedAt: project.updated_at, circuit: project.circuit_json, source: project.permission === "owner" ? "Cloud" : "Shared" }))]);
        }
      } catch { if (!controller.signal.aborted) setProjectError("Could not load all projects. Retry or open Projects."); }
      finally { if (!controller.signal.aborted) setProjectsLoading(false); }
    };
    void load();
    return () => controller.abort();
  }, [userId, retry]);
  const pending = loading || !progress;
  const value = (number: number) => pending ? "—" : number;
  const path = (id: string) => `/${learningModules.find(module => module.id === id)?.category === "Foundation" ? "learn" : "algorithms"}/${id}`;

  return <div className="page-enter mx-auto max-w-[1500px] p-5 sm:p-8">
    <div className="flex flex-wrap items-end justify-between gap-5"><div><p className="text-sm uppercase tracking-widest text-secondary">{pending ? "Your learning workspace" : `Level ${Math.floor(metrics.xp / 1000) + 1} · Quantum Learner`}</p><h1 className="glow-text mt-2 text-4xl font-bold sm:text-6xl">Welcome to Q-SQOOL</h1><p className="mt-3 text-muted-foreground">Your next breakthrough is one experiment away.</p></div><div className="flex gap-3"><button onClick={() => navigate("lab")} className="rounded-xl border border-secondary/55 px-4 py-3 text-secondary"><Plus className="mr-2 inline size-4" />New circuit</button><button onClick={() => navigate("lab")} className="rounded-xl bg-primary px-4 py-3 text-primary-foreground"><Bot className="mr-2 inline size-4" />Circuit guidance</button></div></div>
    <div className="mt-4 flex flex-wrap items-center gap-4"><SyncStatus /><button onClick={refreshProgress} disabled={loading} className="text-sm text-primary underline disabled:opacity-40">Refresh progress</button></div>
    <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4" aria-busy={loading}>
      <article className="glass rounded-2xl p-5"><p className="text-sm text-muted-foreground"><Zap className="mr-2 inline size-4" />Total XP</p><p className="mt-5 text-4xl font-bold">{value(metrics.xp)}</p><Progress aria-label="Progress to next level" value={pending ? 0 : (metrics.xp % 1000) / 10} className="mt-5" /><p className="mt-3 text-xs text-muted-foreground">{pending ? "Loading saved progress…" : `${1000 - metrics.xp % 1000} XP to the next level`}</p></article>
      <article className="glass rounded-2xl p-5"><p className="text-sm text-muted-foreground"><Flame className="mr-2 inline size-4" />Learning streak</p><p className="mt-5 text-4xl font-bold">{value(metrics.streak)} <span className="text-base">days</span></p><div className="mt-5 flex gap-2">{metrics.recentDays.map(day => <span key={day.date} title={`${day.date}: ${day.active ? "learning activity" : "no recorded activity"}`} className={`h-2 flex-1 rounded-full ${day.active ? "bg-secondary" : "bg-foreground/10"}`} />)}</div><p className="mt-3 text-xs text-muted-foreground">Recorded learning advances · UTC days</p></article>
      <article className="glass rounded-2xl p-5"><p className="text-sm text-muted-foreground">Skill mastery</p><p className="mt-5 text-4xl font-bold">{value(metrics.mastery)}{!pending && "%"}</p><Progress aria-label="Curriculum mastery" value={pending ? 0 : metrics.mastery} className="mt-5" /><p className="mt-3 text-xs text-muted-foreground">{pending ? "Loading…" : `${metrics.completed} of ${metrics.total} modules completed`}</p></article>
      <article className="glass rounded-2xl p-5"><p className="font-semibold">Quick tools</p><div className="mt-5 grid gap-3"><button onClick={() => navigate("code")} className="rounded-xl border border-border p-3 text-sm">Import or edit circuit code</button><button onClick={() => navigate("learning")} className="rounded-xl border border-border p-3 text-sm"><BookOpen className="mr-2 inline size-4" />Module library</button></div></article>
    </div>
    <div className="mt-4 grid gap-4 lg:grid-cols-[1.8fr_.9fr]"><div className="space-y-4">
      <article className="glass rounded-2xl border-l-4 border-l-primary p-6"><p className="text-xs uppercase tracking-widest text-primary"><Sparkles className="mr-2 inline size-4" />Continue learning</p><h2 className="mt-5 text-2xl font-semibold">{pending ? "Loading your learning path…" : resume?.title || suggestions[0]?.title || "Explore the curriculum"}</h2><p className="mt-3 text-muted-foreground">{resume ? "Pick up your saved lesson." : "Complete lesson checkpoints and the knowledge check to earn 100 XP per module."}</p><button disabled={pending} onClick={() => router.push(resume ? savedPath : suggestions[0] ? path(suggestions[0].id) : "/learn")} className="mt-5 rounded-xl bg-primary px-6 py-3 text-primary-foreground disabled:opacity-40">{resume ? "Resume lesson" : "Start learning"}<ArrowRight className="ml-2 inline size-4" /></button><Progress aria-label="Saved lesson progress" value={resume ? progress?.modules[resume.id]?.percent || 0 : 0} className="mt-5" /></article>
      <article className="glass rounded-2xl p-6"><div className="flex justify-between"><h2 className="text-xl font-semibold"><FolderOpen className="mr-2 inline size-5 text-primary" />Recent projects</h2><button onClick={() => navigate("projects")} className="text-sm text-secondary">View all</button></div>
        {projectsLoading && <p role="status" className="mt-4 text-muted-foreground">Loading projects…</p>}
        {projectError && <p role="alert" className="mt-4 text-sm text-destructive">{projectError} <button onClick={() => setRetry(value => value + 1)} className="underline">Retry</button></p>}
        {!projectsLoading && !projectError && !projects.length && <p className="mt-5 text-muted-foreground">No saved projects yet. Build a circuit, then save it in Projects.</p>}
        <div className="mt-4 space-y-3">{[...projects].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)).slice(0, 3).map(project => <button key={project.id} onClick={() => { setCircuit(project.circuit); navigate("lab"); }} className="block w-full rounded-xl border border-border p-4 text-left"><strong>{project.name}</strong><span className="mt-1 block text-xs text-muted-foreground">{project.source} · {project.circuit.qubits} qubits · Saved {new Date(project.updatedAt).toLocaleString()}</span></button>)}</div>
      </article></div>
      <article className="glass rounded-2xl p-6"><h2 className="text-2xl font-semibold"><Wand2 className="mr-2 inline size-5 text-secondary" />Suggested path</h2><p className="mt-4 text-sm text-muted-foreground">Lessons selected for your learning role and recorded progress. Prerequisites are guidance, and you can explore any lesson.</p><div className="mt-5 space-y-4">{!pending && suggestions.map(module => <button key={module.id} onClick={() => router.push(path(module.id))} className="block w-full rounded-xl border border-primary/25 p-4 text-left"><strong className="text-primary">{module.title}</strong><span className="mt-2 block text-xs text-muted-foreground">{module.minutes} min · {progress?.modules[module.id]?.percent ? "Continue" : "Ready to start"}</span></button>)}{!pending && !suggestions.length && <p>All modules completed. Revisit the curriculum or experiment in the lab.</p>}</div><button onClick={() => navigate("learning")} className="mt-6 text-sm text-secondary">Learning preferences and assessment →</button></article>
    </div>
  </div>;
}
