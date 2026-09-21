"use client";
import Link from "next/link";
import { Sparkles, ArrowRight } from "lucide-react";
import { learningModules } from "@/lib/curriculum";
import { learningSummary, recommendedModules } from "@/lib/learning-summary";
import { learningTrack, learningTracks } from "@/lib/learning-tracks";
import type { UserProgress } from "@/lib/progress-types";
import { askQuantumCoach } from "@/lib/q-ai-actions";
import styles from "./learning-studio.module.css";

export default function RoleLearningPath({ role, onRoleChange, progress, loading, assessmentScore, openLesson }: {
  role: string; onRoleChange: (role: string) => void; progress: UserProgress | null; loading: boolean; assessmentScore?: number; openLesson: (id: string) => void;
}) {
  const track = learningTrack(role), metrics = learningSummary(progress);
  const recommendations = recommendedModules(progress, role, assessmentScore);
  return <section className={styles.studio} aria-label="Personalised learning path">
    <p className={styles.eyebrow}>CHOOSE YOUR DIRECTION</p><h2>A learning path that changes with you</h2>
    <div className={styles.tabs} role="group" aria-label="Learning role">{Object.values(learningTracks).map(item => <button key={item.role} aria-pressed={role === item.role} disabled={loading} onClick={() => onRoleChange(item.role)}><strong>{item.role}</strong> · {item.focus}</button>)}</div>
    <div aria-live="polite" aria-atomic="true"><h3>{track.title}</h3><p className={styles.goal}>{track.description}</p>{assessmentScore !== undefined && assessmentScore < 2 && <p className={styles.feedback}>Your assessment suggests a foundation refresher. These recommendations introduce the basics through your chosen role.</p>}</div>
    <div className={styles.recommendations}>{!loading && recommendations.map((module, i) => {
      const missing = module.prereqs.filter(id => (progress?.modules[id]?.percent || 0) < 60);
      const started = (progress?.modules[module.id]?.percent || 0) > 0;
      return <article key={module.id}><span className={styles.eyebrow}>{started ? "CONTINUE" : `NEXT ${i + 1}`} · {module.difficulty}</span><h3>{module.title}</h3><p>{module.summary}</p><small>{module.minutes} min · {progress?.modules[module.id]?.percent || 0}% recorded progress</small>{missing.length > 0 && <div className={styles.prerequisites}><span>Helpful first:</span>{missing.map(id => <button key={id} onClick={() => openLesson(id)}>{learningModules.find(item => item.id === id)?.title}</button>)}</div>}<button className={styles.primary} onClick={() => openLesson(module.id)}>{started ? "Continue lesson" : "Explore lesson"}<ArrowRight size={14} /></button></article>;
    })}{loading && <p role="status">Loading your recorded progress…</p>}{!loading && !recommendations.length && <p>All lessons completed. Choose an experiment below to extend your skills.</p>}</div>
    <div className={styles.feedback}><div><strong>Your {track.role.toLowerCase()} experiment</strong><p>{track.task}</p></div><Link href={track.experiment}>{track.action} →</Link><button onClick={() => askQuantumCoach(`My learning role is ${track.role}. My goal is: ${track.description} Recommended modules: ${recommendations.map(m => m.title).join(", ")}. ${assessmentScore === undefined ? "I have not taken the assessment." : `My foundation assessment score is ${assessmentScore}/3.`} Ask me about my experience and time budget, then plan a practical learning session using these lessons. Include ${track.experiment} as a hands-on activity. Do not assume I completed any lessons.`)}><Sparkles size={14} /> AI: personalise my plan</button></div>
    <p className={styles.goal}>{loading ? "Loading…" : `${metrics.xp} XP · ${metrics.completed}/${metrics.total} completed · ${metrics.streak} day streak`} · Based on recorded learning activity.</p>
  </section>;
}
