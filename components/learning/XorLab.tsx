"use client";
import { useState } from "react";
import { ArrowRight, Sparkles } from "lucide-react";
import { practiceState, type PracticeGate } from "@/lib/learning-practice";
import { askQuantumCoach } from "@/lib/q-ai-actions";
import styles from "./learning-studio.module.css";

export default function XorLab() {
  const [a, setA] = useState(0), [b, setB] = useState(0);
  const [step, setStep] = useState(0);
  const [prediction, setPrediction] = useState<number>();
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [superposition, setSuperposition] = useState(false);
  const [sample, setSample] = useState<string>();
  const preparation: PracticeGate[] = [...(a ? [{ type: "X" as const, qubit: 0 as const }] : []), ...(b ? [{ type: "X" as const, qubit: 1 as const }] : [])];
  if (superposition) preparation.push({ type: "H", qubit: 0 });
  const gates: PracticeGate[] = step === 0 ? [] : step === 1 ? preparation : [...preparation, { type: "CX", qubit: 0 }];
  const state = practiceState(gates);
  const target = a ^ b;
  function reset() { setStep(0); setPrediction(undefined); setSample(undefined); }
  function choose(nextA: number, nextB: number) { setA(nextA); setB(nextB); reset(); }
  function advance() {
    const next = Math.min(2, step + 1); setStep(next);
    if (next === 2 && prediction !== undefined && !superposition) setChecked(previous => ({ ...previous, [`${a}${b}`]: prediction === target }));
  }
  function measure() {
    let n = Math.random();
    for (let i = 0; i < 4; i++) { n -= state[i] ** 2; if (n <= 0 || i === 3) { const bits = i.toString(2).padStart(2, "0"); setSample(`a = ${bits[1]}, output b = ${bits[0]}`); break; } }
  }
  const context = `We are in Q-SQOOL's quantum XOR lab. a is control q0; b is target q1; ket order is |b a⟩. Inputs a=${a}, b=${b}. Apply X preparations, ${superposition ? "then H on q0, " : ""}then CX q0→q1. Currently at step ${step}. Amplitudes: ${JSON.stringify(state)}. My prediction for output b was ${prediction ?? "not made"}.`;
  return <section className={styles.studio}>
    <div className={styles.heading}><div><p className={styles.eyebrow}>A QUESTION → AN EXPERIMENT</p><h2>Can a quantum gate compute XOR?</h2><p>Don’t take the answer on trust. Choose two bits and test the circuit.</p></div><span className={styles.badge}>{Object.values(checked).filter(Boolean).length}/4 input pairs predicted correctly</span></div>
    <div className={styles.columns}><div>
      <div className={styles.tools}>{[["a · control q0", a], ["b · target q1", b]].map(([label, value], index) => <label key={label}> {label}<select aria-label={String(label)} value={value} onChange={event => index === 0 ? choose(Number(event.target.value), b) : choose(a, Number(event.target.value))}><option value={0}>0</option><option value={1}>1</option></select></label>)}</div>
      <label className={styles.toggle}><input type="checkbox" checked={superposition} onChange={event => { setSuperposition(event.target.checked); reset(); }} /> Add H to the control: explore quantum superposition</label>
      {!superposition && <div className={styles.prediction}><strong>Predict: what will the target b become?</strong><div className={styles.actions}>{[0, 1].map(value => <button key={value} aria-pressed={prediction === value} disabled={step === 2} onClick={() => setPrediction(value)}>{value}</button>)}</div><small>The control a is preserved. The target changes only when a = 1.</small></div>}
      <div className={styles.circuit} aria-label="XOR quantum circuit"><div className={styles.wire}><span>a · q0</span><span className={styles.gate}>{a ? "X" : "I"}</span>{superposition && <span className={styles.gate}>H</span>}<span className={step === 2 ? styles.gate : styles.empty}>●</span><ArrowRight size={14} /><span>a</span></div><div className={styles.wire}><span>b · q1</span><span className={styles.gate}>{b ? "X" : "I"}</span>{superposition && <span className={styles.empty}>─</span>}<span className={step === 2 ? styles.gate : styles.empty}>⊕</span><ArrowRight size={14} /><span>a XOR b</span></div></div>
      <div className={styles.actions}><button className={styles.primary} disabled={step === 2 || (!superposition && prediction === undefined)} onClick={advance}>{step === 0 ? "1. Prepare inputs" : "2. Apply CNOT"}</button><button onClick={reset}>Try again</button><button disabled={step !== 2} onClick={measure}>Measure one fresh copy</button></div>
      <div className={styles.feedback} role="status">{step === 0 ? "Both physical qubits start in |00⟩. Choose a prediction, then prepare the inputs." : step === 1 ? "X gates prepare your chosen inputs. CNOT has not run yet. Inspect the state on the right." : superposition ? "CNOT correlates the two branches. This is an entangled state: measurement gives one branch, not both outputs at once." : `${prediction === target ? "Correct prediction!" : "Try revising your prediction."} CNOT maps (a,b) = (${a},${b}) to (${a},${target}). ${a ? "The control is 1, so the target flips." : "The control is 0, so the target stays unchanged."}`}</div>
      {sample && <p className={styles.feedback} role="status">Measured {sample}. Each click prepares a fresh copy.</p>}
      <button onClick={() => askQuantumCoach(`${context} Help me understand the current step. If my prediction is wrong, explain the misconception and ask me to test a different input pair. Explain why this is reversible XOR and does not provide a speed advantage over classical XOR.`)}><Sparkles size={15} /> AI: coach me through this step</button>
    </div><aside className={styles.results}><h3>Live quantum state</h3><p>Ket order |b a⟩ = |q1 q0⟩. This simulation applies your gates exactly.</p>{state.map((amplitude, i) => <div className={styles.outcome} key={i}><div><strong>|{i.toString(2).padStart(2, "0")}⟩</strong><span>amplitude {amplitude.toFixed(3)}</span><b>{Math.round(amplitude ** 2 * 100)}%</b></div><meter min={0} max={1} value={amplitude ** 2} aria-label={`Probability of state ${i}`} /></div>)}<h3>Build the truth table</h3><p>Select a row to test it. Outputs appear after your experiment.</p><div className={styles.truthTable}><div><b>a</b><b>b</b><b>Output b</b><b>Your prediction</b></div>{[0, 1, 2, 3].map(i => { const inputA = i >> 1, inputB = i & 1, key = `${inputA}${inputB}`; return <button key={i} onClick={() => { setSuperposition(false); choose(inputA, inputB); }}><span>{inputA}</span><span>{inputB}</span><span>{key in checked ? inputA ^ inputB : "?"}</span><span>{checked[key] === true ? "✓" : checked[key] === false ? "Retry" : "Untested"}</span></button>; })}</div><p>CNOT keeps the control, so no information is lost. Apply it twice to recover the input. Computing XOR this way does not make XOR faster.</p></aside></div>
  </section>;
}
