"use client";
import { useState } from "react";
import { Atom, CheckCircle2, RotateCcw, Sparkles, Undo2 } from "lucide-react";
import { missions, practiceState, missionFidelity, type PracticeGate } from "@/lib/learning-practice";
import { askQuantumCoach } from "@/lib/q-ai-actions";
import styles from "./learning-studio.module.css";

export default function LearningStudio() {
  const [mission, setMission] = useState(0);
  const [gates, setGates] = useState<PracticeGate[]>([]);
  const [wire, setWire] = useState<0 | 1>(0);
  const [checked, setChecked] = useState(false);
  const [hint, setHint] = useState(false);
  const [counts, setCounts] = useState([0, 0, 0, 0]);
  const [solved, setSolved] = useState<number[]>([]);
  const state = practiceState(gates), current = missions[mission];
  const fidelity = missionFidelity(state, current.target);
  const total = counts.reduce((a, b) => a + b, 0);
  function edit(next: PracticeGate[]) { setGates(next); setChecked(false); setCounts([0, 0, 0, 0]); }
  function select(index: number) { setMission(index); edit([]); setHint(false); }
  function measure() {
    const samples = [...counts];
    for (let shot = 0; shot < 100; shot++) {
      let random = Math.random(), outcome = 3;
      for (let i = 0; i < 4; i++) { random -= state[i] ** 2; if (random <= 0) { outcome = i; break; } }
      samples[outcome]++;
    }
    setCounts(samples);
  }
  const context = `I am doing an interactive circuit mission: ${current.goal} Circuit starts in |00⟩. Basis order is |q1 q0⟩. Gates in order: ${JSON.stringify(gates)}. Exact real amplitudes in order 00,01,10,11: ${JSON.stringify(state)}. Target-state fidelity: ${fidelity.toFixed(4)}.`;
  return <section className={styles.studio} aria-label="Interactive quantum missions">
    <div className={styles.heading}><div><p className={styles.eyebrow}><Atom size={15} /> LEARN BY DOING</p><h2>Your first quantum breakthrough</h2><p>Build it. Measure it. Explain why it works.</p></div><span className={styles.badge}>{solved.length}/3 solved this session</span></div>
    <div className={styles.tabs}>{missions.map((item, i) => <button key={item.title} aria-pressed={mission === i} onClick={() => select(i)}>{solved.includes(i) ? "✓" : `0${i + 1}`} {item.title}</button>)}</div>
    <div className={styles.columns}><div>
      <h3>{current.title}</h3><p className={styles.goal}>{current.goal}</p>
      <div className={styles.tools}><label>Apply to <select aria-label="Target qubit" value={wire} onChange={event => setWire(Number(event.target.value) as 0 | 1)}><option value={0}>q0</option><option value={1}>q1</option></select></label>{current.gates.map(type => <button disabled={gates.length >= 12} key={type} onClick={() => edit([...gates, { type: type as PracticeGate["type"], qubit: wire }])}>{type}{type === "CX" ? ` → q${1 - wire}` : ""}</button>)}</div>
      <div className={styles.circuit} aria-label="Your circuit">{[1, 0].map(q => <div key={q} className={styles.wire}><span>q{q} |0⟩</span><div>{gates.length === 0 && <small>Add a gate above</small>}{gates.map((g, i) => <span className={g.qubit === q || g.type === "CX" ? styles.gate : styles.empty} key={i}>{g.qubit === q ? g.type === "CX" ? "●" : g.type : g.type === "CX" ? "⊕" : "─"}</span>)}</div></div>)}</div>
      <div className={styles.actions}><button disabled={!gates.length} onClick={() => edit(gates.slice(0, -1))}><Undo2 size={14} /> Undo</button><button onClick={() => edit([])}><RotateCcw size={14} /> Reset</button><span>{gates.length}/12 gates · read left to right</span></div>
      <div className={styles.actions}><button className={styles.primary} onClick={() => { setChecked(true); if (fidelity > 1 - 1e-8) setSolved(previous => [...new Set([...previous, mission])]); }}>Check my circuit</button><button onClick={() => setHint(!hint)}>Reveal a hint</button><button onClick={() => askQuantumCoach(`${context} Give me one small Socratic hint tailored to my current attempt. Do not reveal the full solution.`)}><Sparkles size={14} /> AI hint</button></div>
      {hint && <p className={styles.feedback}>{current.hint}</p>}
      {checked && <div className={styles.feedback} role="status">{fidelity > 1 - 1e-8 ? <><CheckCircle2 size={18} /> Mission solved! Your amplitudes match the target, including relative phase.</> : <>Not there yet. Target-state fidelity: {Math.round(fidelity * 100)}%. Compare the amplitude signs and probabilities, then change your gates.</>}{fidelity > 1 - 1e-8 && mission < 2 && <button onClick={() => select(mission + 1)}>Next mission →</button>}</div>}
    </div><aside className={styles.results}><h3>Watch the state change</h3><p>Exact ideal probabilities · basis order |q1 q0⟩</p>{state.map((amplitude, i) => <div className={styles.outcome} key={i}><div><strong>|{i.toString(2).padStart(2, "0")}⟩</strong><span>amplitude {amplitude.toFixed(3)}</span><b>{(amplitude ** 2 * 100).toFixed(0)}%</b></div><meter min={0} max={1} value={amplitude ** 2} aria-label={`Probability of ${i.toString(2).padStart(2, "0")}`} /></div>)}<button className={styles.measure} onClick={measure}>Measure 100 fresh copies</button>{total > 0 && <p role="status">{total} shots: {counts.map((n, i) => `${i.toString(2).padStart(2, "0")}: ${n}`).join(" · ")}</p>}<p className={styles.note}>Each shot prepares your circuit again. Sampling varies; changing gates clears the samples.</p><button className={styles.ai} onClick={() => askQuantumCoach(`${context} Explain why my circuit produces these amplitudes. Use my actual gate sequence, explain interference where relevant, and ask me one prediction question.`)}><Sparkles size={15} /> AI: explain my experiment</button></aside></div>
  </section>;
}
