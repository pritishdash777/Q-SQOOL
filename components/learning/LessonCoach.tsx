"use client";
import { useState } from "react";
import { Sparkles } from "lucide-react";
import { askQuantumCoach } from "@/lib/q-ai-actions";
import styles from "./learning-studio.module.css";

export default function LessonCoach({ title, concept }: { title: string; concept: string }) {
  const [explanation, setExplanation] = useState("");
  const context = `I am learning ${title}. Lesson reference: ${concept}.`;
  return <section className={styles.coach}><p className={styles.eyebrow}><Sparkles size={15} /> YOUR AI STUDY PARTNER</p><h2>Can you teach it back?</h2><p>Explain the idea in your own words. q-ai will identify what you understand, correct misconceptions, and suggest your next experiment.</p><label htmlFor={`teach-${title}`}>My understanding</label><textarea id={`teach-${title}`} value={explanation} onChange={event => setExplanation(event.target.value)} maxLength={1800} placeholder="I think this works because…" rows={3} /><div className={styles.actions}><button className={styles.primary} disabled={!explanation.trim()} onClick={() => askQuantumCoach(`${context} Here is my explanation: ${explanation}. Give formative feedback: what I got right, one misconception to correct (if any), and one small next step. Do not award XP or claim lesson completion.`)}>Check my understanding</button><button onClick={() => askQuantumCoach(`${context} Start a fresh adaptive quiz on this topic. Ask one application question at a time, wait for my answer, then give feedback and adjust the difficulty. Do not show the answer yet.`)}>Quiz me with AI</button><button onClick={() => askQuantumCoach(`${context} Teach this with a concrete analogy and a small worked example. Explain where the analogy stops being accurate, then ask me to predict what happens next.`)}>Show me an analogy</button></div></section>;
}
